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
    selectedCompositing: 'ftb',
    selectedRendering: 'volume'
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

  const compositingRadio = (value) => {
    setSettings({ ...settings, selectedCompositing: value })
    triggerRendering()
  }

  const renderingRadio = (value) => {
    console.log(value)
    setSettings({ ...settings, selectedRendering: value })
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
            <label><input type='radio' name='compositing' value='ftb' onChange={() => compositingRadio('ftb')} checked={settings.selectedCompositing === 'ftb'} />Front-to-back</label>
            <label><input type='radio' name='compositing' value='fhp' onChange={() => compositingRadio('fhp')} checked={settings.selectedCompositing === 'fhp'} />First hit-point</label>
            <label><input type='radio' name='compositing' value='mip' onChange={() => compositingRadio('mip')} checked={settings.selectedCompositing === 'mip'} />Maximum-intensity projection</label>
          </div>
        </div>
        <div>
          Camera
          <label> r: <input type='range' min='0' max='100' value={settings.cameraR} className='slider' id='camera-r' onInput={(val) => updateControls(val, 'cameraR')} /></label>
          <label> phi: <input type='range' min='0' max='360' value={settings.cameraPhi} className='slider' id='camera-phi' onInput={(val) => updateControls(val, 'cameraPhi')} /></label>
          <label> theta: <input type='range' min='1' max='180' value={settings.cameraTheta} className='slider' id='camera-theta' onInput={(val) => updateControls(val, 'cameraTheta')} /></label>
        </div>
        <div>
          Debugging
          <div>Rendering output:</div>
          <label><input type='radio' name='debug-output' value='volume' onChange={() => renderingRadio('volume')} checked={settings.selectedRendering === 'volume'} />Volume Rendering</label>
          <label><input type='radio' name='debug-output' value='entry' onChange={() => renderingRadio('entry')} checked={settings.selectedRendering === 'entry'} />Entry Points</label>
          <label><input type='radio' name='debug-output' value='exit' onChange={() => renderingRadio('exit')} checked={settings.selectedRendering === 'exit'} />Exit Points</label>
          <label><input type='radio' name='debug-output' value='direction' onChange={() => renderingRadio('direction')} checked={settings.selectedRendering === 'direction'} />Ray direction</label>
          <label><input type='radio' name='debug-output' value='transfer' onChange={() => renderingRadio('transfer')} checked={settings.selectedRendering === 'transfer'} />Transfer Function</label>
          <label><input type='radio' name='debug-output' value='slice' onChange={() => renderingRadio('slice')} checked={settings.selectedRendering === 'slice'} />Volume Slice</label>
          <label><input type='radio' name='debug-output' value='transferSlice' onChange={() => renderingRadio('transferSlice')} checked={settings.selectedRendering === 'transferSlice'} />Volume Slice with transfer function</label>
        </div>

        <NodeEditor />
      </div>
    </div>

  )
}

export default App
