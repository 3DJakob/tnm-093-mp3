import React, { useEffect, useState } from 'react'
import './App.css'
import { main, updateTransferAndRender, triggerRendering } from './scivis'
// WebGL: INVALID_OPERATION: texImage3D: ArrayBufferView not big enough for request
function App () {
  // const [stepSize, setStepSize] = useState(1000)
  // const [cameraR, setCameraR] = useState()

  useEffect(() => {
    console.log('foo')
    const canvas = document.querySelector('#glCanvas')
    console.log(canvas)
    const gl = canvas.getContext('webgl2')
    main(gl, canvas)
  })

  // useEffect(() => {

  // }, [stepSize, cameraR])

  return (
    <div className='App'>
      <p id='error' />
      <canvas id='glCanvas' width='640' height='480' />
      <div className='controls'>
        <div>
          Rendering parameters
          <div>Step size: <input type='range' min='10' max='10000' value={1000} className='slider' id='stepSize' onInput={triggerRendering} /> </div>
          <div>
            <div>Compositing method:</div>
            <label><input type='radio' name='compositing' value='ftb' onChange={triggerRendering} checked />Front-to-back</label>
            <label><input type='radio' name='compositing' value='fhp' onChange={triggerRendering} />First hit-point</label>
            <label><input type='radio' name='compositing' value='mip' onChange={triggerRendering} />Maximum-intensity projection</label>
          </div>
        </div>
        <div>
          Camera
          <label> r: <input type='range' min='0' max='100' value='50' className='slider' id='camera-r' onInput={triggerRendering} /></label>
          <label> phi: <input type='range' min='0' max='360' value='35' className='slider' id='camera-phi' onInput={triggerRendering} /></label>
          <label> theta: <input type='range' min='1' max='180' value='65' className='slider' id='camera-theta' onInput={triggerRendering} /></label>
        </div>
        <div>
          Transferfunction (very clean)
          <div>Transferfunction output:</div>
          <div> Opacity: <input type='range' min='0' max='100' value='2' className='slider' id='transfer-opacity' onInput={updateTransferAndRender} /></div>
          <div> Red: <input type='range' min='0' max='100' value='100' className='slider' id='transfer-red' onInput={updateTransferAndRender} /></div>
          <div> Green: <input type='range' min='0' max='100' value='100' className='slider' id='transfer-green' onInput={updateTransferAndRender} /></div>
          <div> Blue: <input type='range' min='0' max='100' value='100' className='slider' id='transfer-blue' onInput={updateTransferAndRender} /></div>
          <div> Threshold: <input type='range' min='0' max='100' value='0' className='slider' id='transfer-threshold' onInput={updateTransferAndRender} /></div>

        </div>
        <div>
          Debugging
          <div>Rendering output:</div>
          <label><input type='radio' name='debug-output' value='volume' onChange={triggerRendering} checked />Volume Rendering</label>
          <label><input type='radio' name='debug-output' value='entry' onChange={triggerRendering} />Entry Points</label>
          <label><input type='radio' name='debug-output' value='exit' onChange={triggerRendering} />Exit Points</label>
          <label><input type='radio' name='debug-output' value='direction' onChange={triggerRendering} />Ray direction</label>
          <label><input type='radio' name='debug-output' value='transfer' onChange={triggerRendering} />Transfer Function</label>
          <label><input type='radio' name='debug-output' value='slice' onChange={triggerRendering} />Volume Slice</label>
          <label><input type='radio' name='debug-output' value='slice-transfer' onChange={triggerRendering} />Volume Slice with transfer function</label>
        </div>
      </div>
    </div>

  )
}

export default App
