import React, { useEffect, useState } from 'react'
import './App.css'
import { main, updateTransferAndRender, triggerRendering } from './scivis'
import NodeEditor from './components/NodeEditor'

function App () {
  const [settings, setSettings] = useState({
    stepSize: 1000,
    cameraR: 25,
    cameraPhi: 130,
    cameraTheta: 120,
    transferOpacity: 2,
    transferRed: 100,
    transferGreen: 100,
    transferBlue: 100,
    transferThreshold: 0,
    frontToBack: 'ftb',
    firstHitPoint: 'fhp',
    maxIntensityProj: 'mip',
    volume: 'volume',
    entry: 'entry',
    exit: 'exit',
    transfer: 'transfer',
    direction: 'direction',
    slice: 'slice',
    transferSlice: 'slice-transfer'
  })

  useEffect(() => {
    const canvas = document.querySelector('#glCanvas')
    const gl = canvas.getContext('webgl2')
    main(gl, canvas)
  }, [])

  const updateControls = (e, tagName) => {
    const newObj = settings
    newObj[tagName] = e.target.value
    console.log(newObj[tagName])
    setSettings({ ...newObj })
    triggerRendering()
  }

  return (
    <div className='App'>
      <p id='error' />
      <canvas id='glCanvas' width='640' height='480' />
      <div className='controls'>
        <div>
          Rendering parameters
          <div>Step size: <input type='range' min='10' max='10000' value={settings.stepSize} className='slider' id='stepSize' onInput={(val) => updateControls(val, 'stepSize')} /> </div>
          <div>
            <div>Compositing method:</div>
            <label><input type='radio' name='compositing' value={settings.frontToBack} onChange={(val) => updateControls(val, 'frontToBack')} checked />Front-to-back</label>
            <label><input type='radio' name='compositing' value={settings.firstHitPoint} onChange={(val) => updateControls(val, 'firstHitPoint')} />First hit-point</label>
            <label><input type='radio' name='compositing' value={settings.maxIntensityProj} onChange={(val) => updateControls(val, 'maxIntensityProj')} />Maximum-intensity projection</label>
          </div>
        </div>
        <div>
          Camera
          <label> r: <input type='range' min='0' max='100' value={settings.cameraR} className='slider' id='camera-r' onInput={(val) => updateControls(val, 'cameraR')} /></label>
          <label> phi: <input type='range' min='0' max='360' value={settings.cameraPhi} className='slider' id='camera-phi' onInput={(val) => updateControls(val, 'cameraPhi')} /></label>
          <label> theta: <input type='range' min='1' max='180' value={settings.cameraTheta} className='slider' id='camera-theta' onInput={(val) => updateControls(val, 'cameraTheta')} /></label>
        </div>
        <div>
          Transferfunction (very clean)
          <div>Transferfunction output:</div>
          <div> Opacity: <input type='range' min='0' max='100' value={settings.transferOpacity} className='slider' id='transfer-opacity' onInput={updateTransferAndRender} /></div>
          <div> Red: <input type='range' min='0' max='100' value={setSettings.transferRed} className='slider' id='transfer-red' onInput={updateTransferAndRender} /></div>
          <div> Green: <input type='range' min='0' max='100' value={settings.transferGreen} className='slider' id='transfer-green' onInput={updateTransferAndRender} /></div>
          <div> Blue: <input type='range' min='0' max='100' value={settings.transferBlue} className='slider' id='transfer-blue' onInput={updateTransferAndRender} /></div>
          <div> Threshold: <input type='range' min='0' max='100' value={settings.transferThreshold} className='slider' id='transfer-threshold' onInput={updateTransferAndRender} /></div>
        </div>
        <div>
          Debugging
          <div>Rendering output:</div>
          <label><input type='radio' name='debug-output' value={settings.volume} onChange={(val) => updateControls(val, 'volume')} checked />Volume Rendering</label>
          <label><input type='radio' name='debug-output' value={settings.entry} onChange={(val) => updateControls(val, 'frontToBack')} />Entry Points</label>
          <label><input type='radio' name='debug-output' value={settings.exit} onChange={(val) => updateControls(val, 'exit')} />Exit Points</label>
          <label><input type='radio' name='debug-output' value={settings.direction} onChange={(val) => updateControls(val, 'direction')} />Ray direction</label>
          <label><input type='radio' name='debug-output' value={settings.transfer} onChange={(val) => updateControls(val, 'transfer')} />Transfer Function</label>
          <label><input type='radio' name='debug-output' value={settings.slice} onChange={(val) => updateControls(val, 'slice')} />Volume Slice</label>
          <label><input type='radio' name='debug-output' value={settings.transferSlice} onChange={(val) => updateControls(val, 'transferSlice')} />Volume Slice with transfer function</label>
        </div>

        <NodeEditor />
      </div>
    </div>

  )
}

export default App
