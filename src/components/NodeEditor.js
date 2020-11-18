import React, { useEffect, useMemo, useState } from 'react'
import { ChromePicker } from 'react-color'
import styled from 'styled-components'
import { v4 as uuidv4 } from 'uuid'
import { updateTransferAndRender, getDensities } from '../scivis'
import { rgbObjToRgbString } from '../lib/utils'

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`

const Editor = styled.svg`
  position: relative;
  box-shadow: 0 0 20px #999;
  border-radius: 5px;
  background-color: #fff;
  margin: 40px;

  .shadow {
    -webkit-filter: drop-shadow( 3px 3px 2px rgba(0, 0, 0, .7));
    filter: drop-shadow( 3px 3px 2px rgba(0, 0, 0, .7));
    /* Similar syntax to box-shadow */
  }
`

const createNode = (x = 0, y = 0, color = { r: 202, g: 83, b: 83, a: 1 }) => {
  return {
    x: x,
    y: y,
    color: color,
    id: uuidv4()
  }
}

const editorPadding = 20

const getRelativeCoordinates = (event) => {
  const rect = event.target.getBoundingClientRect()
  const x = event.clientX - rect.left - editorPadding
  const y = event.clientY - rect.top - editorPadding
  return { x, y }
}

let initiated = false

export const setDensities = (densities) => {
  console.log(densities)
}

const fetchDensities = async () => {
  let response
  try {
    response = await window.fetch('pig.raw')
  } catch (error) {
    // Something went wrong, so we have to bail
    window.alert("Error accessing volume 'pig.raw': " + error)
    return
  }
  if (!response.ok) {
    // The fetch request didn't fail catastrophically, but it still didn't succeed
    window.alert("Error accessing volume 'pig.raw'")
    return
  }
  const blob = await response.blob()
  // Convert it into an array buffer
  console.log(112, 'Cast the blob into an array buffer')
  const data = await blob.arrayBuffer()
  // From the available meta data for the pig.raw dataset I know that each voxel is
  // 16 bit unsigned integer
  console.log(113, 'Cast the array buffer into a Uint16 typed array')
  const typedData = new Uint16Array(data)
  // Our volume renderer really likes 8 bit data, so let's convert it
  console.log(114, 'Convert the array into a Uint8 array')
  // const convertedData = new Uint8Array(typedData.length)
  const convertedData = new Uint8Array(512 * 512 * 134)
  for (let i = 0; i < typedData.length; i++) {
    // The range of the dataset is [0, 4096), so we need to convert that into
    // [0, 256) manually
    convertedData[i] = typedData[i] / 4096.0 * 256.0
  }

  // console.log(convertedData)

  const densities = convertedData.filter(data => data > 3)
  return densities
}

function NodeEditor ({ width = 300, height = 300 }) {
  const [nodes, setNodes] = useState([createNode(0, height), createNode(width, 0)])
  const [currentlyMoving, setCurrentlyMoving] = useState(null)
  const [selected, setSelected] = useState(null)
  const [currentColor, setCurrentColor] = useState('#fff')
  const [histogram, setHistogram] = useState(['0 0'])

  const points = React.useMemo(() => {
    if (nodes == null) return []

    return nodes.map((node) => {
      return node.x + ' ' + node.y
    })
  }, [nodes])

  const sortNodes = (nodes) => {
    const sorted = nodes.sort((a, b) => a.x - b.x)
    return sorted
  }

  const addNode = (node) => {
    const newState = [...nodes, node]
    const sorted = sortNodes(newState)
    setNodes(sorted)
  }

  const mouseDown = (event) => {
    const coordinates = getRelativeCoordinates(event)
    const newNode = createNode(coordinates.x, coordinates.y, { r: 0, g: 255, b: 0, a: 1 })
    setSelected(newNode.id)
    addNode(newNode)
    setCurrentlyMoving(newNode.id)
  }

  const circleMouseDown = (event, node) => {
    event.stopPropagation()
    setSelected(node.id)
    setCurrentlyMoving(node.id)
    setCurrentColor(node.color)
  }

  const updateNode = (id, x, y) => {
    const newArray = nodes.map((node) => {
      if (node.id === id) {
        node.x = x
        node.y = y
      }
      return node
    })
    setNodes(sortNodes([...newArray]))
  }

  const mouseMove = (event) => {
    if (currentlyMoving && currentlyMoving !== nodes[0].id && currentlyMoving !== nodes[nodes.length - 1].id) {
      const coordinates = getRelativeCoordinates(event)
      if (coordinates.x < 6 && coordinates.y < 6) { return }
      updateNode(currentlyMoving, coordinates.x, coordinates.y)
    }
  }

  const mouseRelease = (event) => {
    setCurrentlyMoving(false)
  }

  const changeColor = (color) => {
    const newNodes = nodes.map((node) => {
      if (node.id === selected) {
        node.color = color.rgb
      }
      return node
    })
    setNodes(sortNodes([...newNodes]))
    setCurrentColor(color)
  }

  const updateRender = () => {
    const mappedNodes = nodes.map(node => {
      return { ...node, x: node.x / width, y: Math.abs(1 - node.y / height) }
    })

    updateTransferAndRender(mappedNodes)
  }

  useEffect(() => {
    initiated = true
    updateRender()

    const fetchData = async () => {
      const densities = await fetchDensities()
      const coordinates = new Array(256).fill(0)
      let max = 0
      for (const density of densities) {
        coordinates[density]++
        max = coordinates[density] > max ? coordinates[density] : max
      }
      const coordinatestring = coordinates.map((coordinate, i) => i / 255 * width + ' ' + Math.abs(1 - coordinate / max) * height)
      coordinatestring.push('300 300')
      coordinatestring.push('0 300')
      setHistogram(coordinatestring)
    }
    fetchData()
  }, [])

  useMemo(() => {
    if (initiated) {
      updateRender()
    }
  }, [nodes])

  return (
    <Container>

      <Editor id='mySVG' width={width + editorPadding * 2} height={height + editorPadding * 2} onMouseDown={mouseDown} onMouseUp={mouseRelease} onMouseMove={mouseMove} onMouseLeave={mouseRelease}>
        <g transform={'translate(' + editorPadding + ' ' + editorPadding + ')'}>
          <polyline strokeWidth={1} stroke='none' fill='rgb(168, 190, 255, 0.4)' points={histogram.join(' ')} />
          <text fontSize='12' fontWeight='bolder' x={0} y={0}>Piggy Editor</text>
          <polyline fill='none' strokeWidth={1} stroke='black' points={points.join(' ')} />

          {nodes.map((node) => <circle onMouseDown={(e) => circleMouseDown(e, node)} key={node.id} cx={node.x} cy={node.y} fill={rgbObjToRgbString(node.color)} stroke={node.id === selected ? 'black' : 'none'} strokeWidth={2} r={8} />)}
        </g>
      </Editor>

      {/* <button onClick={() => updateTransferAndRender(nodes.map(node => {
        node.x = node.x / width
        node.y = node.y / height
        return node
      }))}
      >FOOO
      </button> */}

      <ChromePicker color={currentColor} onChange={changeColor} />
    </Container>
  )
}
export default NodeEditor
