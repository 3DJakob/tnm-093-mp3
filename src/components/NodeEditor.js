import React, { useState } from 'react'
import { ChromePicker } from 'react-color'
import styled from 'styled-components'
import { v4 as uuidv4 } from 'uuid'

const Container = styled.div`

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

const createNode = (x = 0, y = 0, color = '#fff') => {
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

function NodeEditor ({ width = 300, height = 300 }) {
  const [nodes, setNodes] = useState([createNode(0, height), createNode(width, 0)])
  const [currentlyMoving, setCurrentlyMoving] = useState(null)
  const [selected, setSelected] = useState(null)
  const [currentColor, setCurrentColor] = useState('#fff')

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
    const newNode = createNode(coordinates.x, coordinates.y, 'green')
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
        node.color = color.hex
      }
      return node
    })
    setNodes(sortNodes([...newNodes]))
    setCurrentColor(color)
  }

  return (
    <Container>

      <Editor id='mySVG' width={width + editorPadding * 2} height={height + editorPadding * 2} onMouseDown={mouseDown} onMouseUp={mouseRelease} onMouseMove={mouseMove} onMouseLeave={mouseRelease}>
        <g transform={'translate(' + editorPadding + ' ' + editorPadding + ')'}>
          <text fontSize='12' fontWeight='bolder' x={0} y={0}>Piggy Editor</text>
          <polyline fill='none' strokeWidth={1} stroke='black' points={points.join(' ')} />
          {nodes.map((node) => <circle onMouseDown={(e) => circleMouseDown(e, node)} key={node.id} cx={node.x} cy={node.y} fill={node.color} stroke={node.id === selected ? 'black' : 'none'} strokeWidth={2} r={8} />)}
        </g>
      </Editor>

      <p>Hello piggy</p>

      <ChromePicker color={currentColor} onChange={changeColor} />
    </Container>
  )
}
export default NodeEditor
