import { mat4 } from 'gl-matrix'

//
//   Space for some global variables
//
// This variable stores whether the image that is currently on screen is correct or not.
// The volume rendering is only triggered if this value is set to 'true' in order to save
// computational resources that would be wasted recreating the same image over and over
// again.  This value is set to true by any user input that modifies the rendering
let RenderingIsDirty = true
let TransferFunctionIsDirty = true

//
//   Shader codes
//

// OBS:  For all shaders, "#version 300 es" has to be the first token in the source, so
//
// var vertexSource = `
// #version 300 es
//
// would not work as there is a \n after `
//

// The vertex shader contains hardcorded positions for a generic bounding box.  The box is
// created as a unit cube from -1 to 1.  The box will then be scaled to the correct size
// and proportions using the model matrix in case we are looking at a  non-cube dataset.
// We are building a cube as a bounding box:
//
//           7---------------------6
//          /|                    /|
//         / |                   / |
//        /  |                  /  |
//       /   |                 /   |
//      3----+----------------2    |
//      |    |                |    |
//      |    |                |    |
//      |    4----------------+----5
//      |   /                 |   /
//      |  /                  |  /
//      | /                   | /
//      |/                    |/
//      0---------------------1
//
//  y
//  ^
//  |  z
//  | /
//  |/
//  o-----> x
//
// So we are generating the triangles:
// (0, 2, 1), (0, 3, 2)  for the front side
// (1, 6, 5), (1, 2, 6)  for the right side
// (4, 3, 0), (4, 7, 3)  for the left side
// (4, 6, 7), (4, 5, 6)  for the back side
// (3, 6, 2), (3, 7, 6)  for the top side
// (1, 4, 0), (1, 5, 4)  for the bottom side

const boundingBoxVertexSource = `#version 300 es
  // WebGL2 requires specifying the floating point precision once per program object
  precision highp float;

  #line 77 // This sets the line numbers to match with the line numbers in this file
  // Hard-code all of the vertices for a 6-face cube centered on 0 with a side-length of 1
  const vec3 p0 = vec3(-1.0, -1.0, -1.0);
  const vec3 p1 = vec3( 1.0, -1.0, -1.0);
  const vec3 p2 = vec3( 1.0,  1.0, -1.0);
  const vec3 p3 = vec3(-1.0,  1.0, -1.0);
  const vec3 p4 = vec3(-1.0, -1.0,  1.0);
  const vec3 p5 = vec3( 1.0, -1.0,  1.0);
  const vec3 p6 = vec3( 1.0,  1.0,  1.0);
  const vec3 p7 = vec3(-1.0,  1.0,  1.0);
  // 6 faces * 2 triangles/face * 3 vertices/triangles = 36 vertices
  const vec3 positions[36] = vec3[](
    p0, p2, p1,      p0, p3, p2,   // front side
    p1, p6, p5,      p1, p2, p6,   // right side
    p4, p3, p0,      p4, p7, p3,   // left side
    p4, p6, p7,      p4, p5, p6,   // back side
    p3, p6, p2,      p3, p7, p6,   // top side
    p1, p4, p0,      p1, p5, p4    // bottom side
  );

  // Specifies the varying variable that stores the position of the vertex.  The value of
  // this variable will be interpolated in the fragment shader
  out vec3 position;

  // The model matrix specifies the transformation for the current bounding box
  uniform mat4 modelMatrix;
  // The view matrix specifies information about the location of the virtual camera
  uniform mat4 viewMatrix;
  // The projection matrix determines the projection and its parameters, like FOV
  uniform mat4 projectionMatrix;

  void main() {
    // gl_VertexID is a library-defined variable that corresponds to the number of the
    // vertex for which the vertex shader is currently being evaluated
    vec4 p = vec4(positions[gl_VertexID], 1.0);

    // gl_Position is a library-defined variable that needs to be set by the vertex shader
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * p;

    // Just passing the value along for the fragment shader to interpolate the value
    // between the vertices
    position = p.xyz;
  }
`

const boundingBoxFragmentSource = `#version 300 es
  // WebGL2 requires specifying the floating point precision once per program object
  precision highp float;

  #line 126 // This sets the line numbers to match with the line numbers in this file
  // Incoming varying variable from the vertex shader
  in vec3 position;

  // Define the output variable as a vec4 (= color)
  out vec4 out_color;

  void main() {
    // Using the position as the red and green components of the color since the positions
    // are in [-1, 1] and the colors are in [0, 1], we need to renormalize here
    vec3 normPos = (position + vec3(1.0)) / vec3(2.0);
    out_color = vec4(normPos, 1.0);
  }
`

// The vertex shader hardcodes the screen-aligned quad that is used to trigger the
// fragment shader.
//
// We are building a screen-aligned quad:
//
// 3--------------------------2
// |                          |
// |                          |
// |                          |
// |                          |
// |                          |
// 0--------------------------1
//
//  y
//  ^
//  |
//  |
//  |
//  o-----> x

// So we are generating the triangles: (0, 1, 2), (1, 2, 3)

const volumeRenderingVertexSource = `#version 300 es
  // WebGL2 requires specifying the floating point precision once per program object
  precision highp float;

  #line 167 // This sets the line numbers to match with the line numbers in this file
  const vec2 p0 = vec2(-1.0, -1.0);
  const vec2 p1 = vec2( 1.0, -1.0);
  const vec2 p2 = vec2( 1.0,  1.0);
  const vec2 p3 = vec2(-1.0,  1.0);
  // 1 quad * 2 triangles / quad * 3 vertices / triangle = 6 vertices
  const vec2 positions[6] = vec2[](p0, p1, p2,    p0, p2, p3);

  // This varying variable represents the texture coordinates that are used for the rays
  out vec2 st;

  void main() {
    // gl_VertexID is a library-defined variable that corresponds to the number of the
    // vertex for which the vertex shader is currently being evaluated
    vec2 p = positions[gl_VertexID];

    // We can use the position here directly
    gl_Position = vec4(p, 0.0, 1.0);

    // The positions are in range [-1, 1], but the texture coordinates should be [0, 1]
    st = (p + vec2(1.0)) / vec2(2.0);
  }
`

const volumeRenderingFragmentSource = `#version 300 es
  // WebGL2 requires specifying the floating point precision once per program object
  precision highp float;
  precision highp sampler2D;
  precision highp sampler3D;

  #line 197 // This sets the line numbers to match with the line numbers in this file
  uniform sampler2D entryPoints;  // The texture that holds the entry points
  uniform sampler2D exitPoints;   // The texture that holds the exit points

  uniform sampler3D volume;       // The texture that holds the volume data
  uniform sampler2D transferFunction; // The texture that holds the transfer function data
                                      // WebGL doesn't like 1D textures, so this is a 2D
                                      // texture that is only 1 pixel high
  uniform float stepSize;             // The ray step size as determined by the user
  uniform int renderType;             // The value of the 'Rendering output' parameter
  uniform int compositingMethod;      // The value of the 'Compositing method' parameter


  // Poor man's enum for the compositing methods.  If additional compositing methods are
  // added, they have to be accounted for in the rendering function as well
  const int CompositingMethodFrontToBack = 0;
  const int CompositingMethodFirstHitPoint = 1;
  const int CompositingMethodMaximumIntensityProjection = 2;

  in vec2 st; // This is the texture coordinate of the fragment that we are currently
              // computing.  This is used to look up the entry/exit points to compute the
              // direction of the ray
  out vec4 out_color; // The output variable where we will store the final color that we
                      // painstakingly raycasted

  /// This function computes the final color for the ray traversal by actually performing
  /// the volume rendering.
  /// @param entryCoord The coordinate where the ray enters the bounding box
  /// @param exitCoord The coordinates where the ray exits the bounding box
  /// @return The final color that this ray represents
  vec4 traverseRay(vec3 entryCoord, vec3 exitCoord) {
    // Make some space to collect the resulting color for this ray
    vec4 result = vec4(0.0);

    // Compute the ray direction based of the entry and exit coordinates
    vec3 rayDirection = exitCoord - entryCoord;

    // This is our ray-advance parameter which will go from t=0 for the entry point to
    // t=tEnd for the exit point of the ray
    float t = 0.0;

    // Actually compute tEnd
    float tEnd = length(rayDirection);

    // Normalize the ray direction
    rayDirection = normalize(rayDirection);

    // The user gave us a step size along the ray, so we are using it here.  Every step
    // along the ray, we are incrementing t by tIncr and have a look at the sample
    float tIncr = stepSize;

    // Start with the volume rendering.  We continue with this loop until we are either
    // reaching the end of the ray (t >= tEnd) or if our resulting color is so saturated
    // (result.a >= 0.99) that any other samples that would follow would have so little
    // impact as to make the computation unnecessary (called early ray termination)
    bool firstBounce = true;
    while (t < tEnd && result.a < 0.99) {
      // Compute the current sampling position along the ray
      vec3 sampleCoord = entryCoord + t * rayDirection;

      // Sample the volume at the sampling position.  The volume we are looking at is a
      // scalar volume, so it only has a single value, which we extract here from the r
      // component
      float value = texture(volume, sampleCoord).r;

      // Feed the value through the transfer function.  The 0.5 here is a crux as WebGL2
      // does not support 1D textures, so we need to choose a coordinate for the second
      // dimension.  The transfer function texture only has a single pixel in the second
      // dimension and we want to avoid any potential issues with interpolation, so we
      // access the pixel right in the center
      vec4 color = texture(transferFunction, vec2(value, 0.5));

      // We only want to continue if the sample we are currently using actually has any
      // contribution.  If the alpha value is 0, it will not contribute anything, so skip
      if (color.a > 0.0) {
        if (compositingMethod == CompositingMethodFrontToBack) {
          // This line is a bit magic.  Basically, we want to prevent that the brightness
          // of the resulting image that we generate depends on the stepSize the user
          // chooses.  Higher step size means more samples per pixel, so we need to reduce
          // the impact of each sample to keep the overall pixel value roughly the same.
          // 150 is a randomly chosen value to serve as a reference contribution
          const float ReferenceSamplingInterval = 150.0;
          color.a = 1.0 - pow(1.0 - color.a, tIncr * ReferenceSamplingInterval);

          //
          //   @TODO: Implement the front-to-back compositing here
          //
          result = result + color;




        }
        else if (compositingMethod == CompositingMethodFirstHitPoint) {
          //
          //   @TODO: Implement the first hitpoint compositing here
          //
          if (firstBounce) {
            result = color;
            firstBounce = false;
          }





        }
        else if (compositingMethod == CompositingMethodMaximumIntensityProjection) {
          //
          //   @TODO: Implement the maximum-intensity projection here
          //

          if (color.a > result.a) {
            result = color;
          }


        }
      }

      // Step further along the ray
      t += tIncr;
    }

    // If we get here, the while loop above terminated, so we are done with the ray, so
    // we can return the result
    return result;
  }

  void main() {
    // Access the entry point texture at our current pixel location to get the entry pos
    vec3 entryCoord = texture(entryPoints, st).rgb;
    // Access the exit point texture at our current pixel location to get the exit pos
    vec3 exitCoord = texture(exitPoints, st).rgb;

    // Poor man's enum for the render types.  These values should be synchronized with the
    // render function in case any of the numbers change
    const int RenderTypeVolumeRendering = 0;
    const int RenderTypeEntryPoints = 1;
    const int RenderTypeExitPoints = 2;
    const int RenderTypeRayDirection = 3;
    const int RenderTypeTransferFunction = 4;
    const int RenderTypeVolumeSlice = 5;
    const int RenderTypeVolumeSliceWithTransferFunction = 6;

    // The values that are checked against here have to be synced with the renderVolume
    if (renderType == RenderTypeVolumeRendering) {
      // Check for an early out. If the entry coordinate is the same as the exit
      // coordinate then our current pixel is missing the volume, so there is no need for
      // any ray traversal
      if (entryCoord == exitCoord) {
        discard;
      }

      // Perform the raycasting using the entry and the exit pos
      vec4 pixelColor = traverseRay(entryCoord, exitCoord);

      // As the raycasting might not return a fully opaque color (for example if the ray
      // exits the volume without being fully saturated), we can't just assing the color,
      // but need to mix (=lerp) it with a fully black background color
      out_color = mix(vec4(0.0, 0.0, 0.0, 1.0), pixelColor, pixelColor.a);
    }
    else if (renderType == RenderTypeEntryPoints) {
      // Just rendering the entry point coordinate back as a color
      out_color = vec4(entryCoord, 1.0);
    }
    else if (renderType == RenderTypeExitPoints) {
      // Just rendering the exit point coordinate back as a color
      out_color = vec4(exitCoord, 1.0);
    }
    else if (renderType == RenderTypeRayDirection) {
      // Render the ray direction as a color. We need to take the absolute value here as
      // it is difficult to render negative colors
      out_color = vec4(abs(exitCoord - entryCoord), 1.0);
    }
    else if (renderType == RenderTypeTransferFunction) {
      // Just render the transfer function into the viewport
      vec4 c = texture(transferFunction, vec2(st));
      out_color = vec4(c.rgb, 1.0);
    }
    else if (renderType == RenderTypeVolumeSlice) {
      // Take a central slice of the volume and render it to the screen. This is mainly
      // meant as a control for the next option.
      float value = texture(volume, vec3(st, 0.5)).r;
      out_color = vec4(value, value, value, 1.0);
    }
    else if (renderType == RenderTypeVolumeSliceWithTransferFunction) {
      // Take a central slice out of the volume and render it to the screen.  Then, apply
      // the transfer function to all pixels.  This rendering option can be used to verify
      // that the transfer function editor works as expected before trying it on the
      // volume rendering
      float value = texture(volume, vec3(st, 0.5)).r;
      vec4 c = texture(transferFunction, vec2(value, 0.5));
      out_color = vec4(c.rgb, 1.0);
    }
  }
`

/// This function creates an OpenGL program object from the provided vertex and fragment
/// sources.  If the creation of the OpenGL shader objects or the OpenGL program object
/// fails, a null object is returned.
/// @param gl the OpenGL context in which the program is created
/// @param vertexSource the source that is used for compiling the vertex shader
/// @param fragmentSource the source that is used for compiling the fragment shader
/// @return the compiled and linked program object or null if there was an error with the
///         compilation or the linking
function createProgram (gl, vertexSource, fragmentSource) {
  // Helper function to load a shader of the specified type (Vertex or Fragment)
  function loadShader (gl, type, source) {
    // Create the ShaderObject
    const shader = gl.createShader(type)

    // Set the source code of the shader
    gl.shaderSource(shader, source)

    // Compile the shader code
    gl.compileShader(shader)

    // Check for compile errors
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      postError('Failed to compile shader: ' + gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      return null
    } else {
      return shader
    }
  }

  // Create the vertex shader object
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexSource)
  // Create the fragment shader object
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentSource)

  // If either of the shaders failed to compile, we bail out
  if (!vertexShader || !fragmentShader) {
    return
  }

  // Create the ProgramObject
  const program = gl.createProgram()
  // Attach the vertex and fragment shaders to the program object
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  // Link the Program Object
  gl.linkProgram(program)

  // Check for linking errors
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    postError('Failed to create program object: ' + gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return
  }

  return program
}

export function updateTransferAndRender () {
  // console.log('foobar')
  const canvas = document.querySelector('#glCanvas')
  gl = canvas.getContext('webgl2')
  const transferFunctionTexture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, transferFunctionTexture)
  updateTransferFunction(gl, transferFunctionTexture)
  triggerTransferFunctionUpdate()
  // triggerRendering()
}

/// This function is called when the transfer function texture on the GPU should be
/// updated.  Whether the transfer function values are computed here or just retrieved
/// from somewhere else is up to decide for the implementation.
///
/// @param gl the OpenGL context
/// @param transferFunction the texture object that is updated by this function
function updateTransferFunction (gl, transferFunction) {
  // Create a new array that holds the values for the transfer function.  The width of 256
  // is also hard-coded further down where the transferFunctionTexture OpenGL object is
  // created, so if you want to change it here, you have to change it there as well.  We
  // multiply the value by 4 as we have RGBA for each pixel.
  // Also we created the transfer function texture using the UNSIGNED_BYTE type, which
  // means that every value in the transfer function has to be between [0, 255]

  // This data should, at the end of your code, contain the information for the transfer
  // function.  Each value is stored sequentially (RGBA,RGBA,RGBA,...) for 256 values,
  // which get mapped to [0, 1] by OpenGL
  const data = new Uint8Array(256 * 4)

  /// /////////////////////////////////////////////////////////////////////////////////////
  /// Beginning of the provided transfer function

  // The provided transfer function that you'll replace with your own solution is a
  // relatively simple ramp with the first 50 values being set to 0 to reduce the noise in
  // the image.  The remainder of the ramp is just using different angles for the color
  // components
  const cutoff = 50

  for (let i = 0; i < cutoff * 4; i += 4) {
    // Set RGBA all to 0
    data[i] = 0
    data[i + 1] = 0
    data[i + 2] = 0
    data[i + 3] = 0
  }

  // TRANSFER FUNCTION, Too bad!!

  // For now, just create a linear ramp from 0 to 1. We start at the cutoff value and fill
  // the rest of the array
  // for (let i = cutoff * 4; i < 256 * 4; i += 4) {
  //   // convert i into a value [0, 256] and set it
  //   const it = i / 4;
  //   data[i] = 2 * it;
  //   data[i + 1] = it;
  //   data[i + 2] = 3 * it;
  //   data[i + 3] = it;
  // }

  const opacity = Number(document.getElementById('transfer-opacity').value) / 100
  const red = Number(document.getElementById('transfer-red').value) / 100
  const green = Number(document.getElementById('transfer-green').value) / 100
  const blue = Number(document.getElementById('transfer-blue').value) / 100
  const threshold = Number(document.getElementById('transfer-threshold').value) / 100

  console.log(opacity)

  for (let i = cutoff * 4; i < 256 * 4; i += 4) {
    // convert i into a value [0, 256] and set it
    const it = i * opacity / 4
    // console.log(it)
    // console.log(it + ' vs ' + threshold * 255)
    if (it / opacity < threshold * 255) {
      data[i] = 0 // Red
      data[i + 1] = 0 // Green
      data[i + 2] = 0 // Blue
      data[i + 3] = 0 // Alpha
    } else {
      data[i] = 2 * it * red // Red
      data[i + 1] = it * green // Green
      data[i + 2] = 3 * it * blue // Blue
      data[i + 3] = it // Alpha
    }
  }

  /// End of the provided transfer function
  /// /////////////////////////////////////////////////////////////////////////////////////

  // @TODO:  Replace the transfer function specification above with your own transfer
  //         function editor result

  // Upload the new data to the texture
  console.log(117, 'Updating the transfer function texture')
  gl.bindTexture(gl.TEXTURE_2D, transferFunction)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
}

/// Function that renders the bounding box using the provided model and view matrices. The
/// front-facing triangles are rendered into the framebuffer provided at 'fbFront', the
/// back-facing triangles will be rendered into the 'fbBack' framebuffer using the shader
/// program 'program'.
///
/// @param gl the OpenGL context
/// @param program the Program Object that is used to render the bounding box
/// @param modelMatrix the matrix that encodes the deformation of the bounding box that
///        should be done to accomodate non-cube volumetric datasets
/// @param viewMatrix the matrix that encodes the location of the camera
/// @param projectionMatrix the projection matrix that encodes the camera parameters
/// @param fbFront the Framebuffer to which the front side of the bounding box is rendered
/// @param fbBack the Framebuffer to which the back side of the bounding box is rendered
function renderBoundingbox (gl, program, modelMatrix, viewMatrix, projectionMatrix,
  fbFront, fbBack) {
  //
  //   Initial setup common for both the front and back side
  //
  gl.enable(gl.CULL_FACE)

  // Set the matrices used for the perspective rendering of the bounding box
  gl.useProgram(program)
  {
    const location = gl.getUniformLocation(program, 'modelMatrix')
    gl.uniformMatrix4fv(location, false, modelMatrix)
  }
  {
    const location = gl.getUniformLocation(program, 'viewMatrix')
    gl.uniformMatrix4fv(location, false, viewMatrix)
  }
  {
    const location = gl.getUniformLocation(program, 'projectionMatrix')
    gl.uniformMatrix4fv(location, false, projectionMatrix)
  }

  //
  // First render the back side
  //
  // Bind the back framebuffer as the target to modify
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbBack)

  // Clear the color
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  // We are rendering the back side of the bounding box, so we want to cull the
  // front-facing triangles
  gl.cullFace(gl.FRONT)

  // Our bounding box consists of 36 vertices, so we pass that number here. All of the
  // vertex positions are hardcoded in the shader, so there is no need to get into the
  // vertex buffer shizzle over here
  gl.drawArrays(gl.TRIANGLES, 0, 36)

  //
  // Then render the front side
  //
  // Bind the front framebuffer as the target to modify
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbFront)

  // Clear the color
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  // We are rendering the front side of the bounding box, so we want to cull the
  // back-facing triangles
  gl.cullFace(gl.BACK)

  // Our bounding box consists of 36 vertices, so we pass that number here. All of the
  // vertex positions are hardcoded in the shader, so there is no need to get into the
  // vertex buffer shizzle over here
  gl.drawArrays(gl.TRIANGLES, 0, 36)
}

/// This function renders the volume into the main framebuffer.
/// @param gl the OpenGL context
/// @param program the volume rendering program object that is executed to raycast
/// @param entryTexture the texture object that contains the entry point texture to
///        determine the entry point for each ray of the image
/// @param exitTexture the texture object that contains the exit point texture to
///        determine the exit point for each ray of the image
/// @param transferFunctionTexture the texture object that contains the transfer function
///        that should be used in the direct volume rendering
/// @param the step size between samples along the ray as determined by the user
/// @param compositingType the kind of compositing that should be used during the
///        rendering.  Might be 'ftb' for front-to-back compositing, 'fhp' for the first
///        hit point compositing, or 'mip' for maximum-intensity projection compositing
/// @param renderType the type of rendering that we want to create on the screen. This
///        value is mainly used for debugging purposes and might be 'volume' if the direct
///        volume rendering is desired, 'entry' if only the entry points should be shown,
///        'exit' if the exit points should be rendered, 'direction' if the absolute value
///        of the ray direction for each pixel is desired, 'transfer' to show a
///        representation of the transfer function, 'slice' to show a single grayscale
///        slice of the volume, and finally 'slice-transfer' to show a single slide of the
///        volume but with the transfer function applied to each pixel
function renderVolume (gl, program, volumeTexture, entryTexture, exitTexture,
  transferFunctionTexture, stepSize, compositingType, renderType) {
  // Change the framebuffer to the browser-provided one
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  // Clear the color
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  // Bind the program used to render the volume
  gl.useProgram(program)

  // Bind the entry point texture
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, entryTexture)

  gl.uniform1i(gl.getUniformLocation(program, 'entryPoints'), 0) // 0 == gl.TEXTURE0

  // Bind the exit point texture
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, exitTexture)

  gl.uniform1i(gl.getUniformLocation(program, 'exitPoints'), 1) // 1 == gl.TEXTURE1

  // Bind the volume texture
  gl.activeTexture(gl.TEXTURE2)
  gl.bindTexture(gl.TEXTURE_3D, volumeTexture)

  gl.uniform1i(gl.getUniformLocation(program, 'volume'), 2) // 2 == gl.TEXTURE2

  // Bind the transfer function
  gl.activeTexture(gl.TEXTURE3)
  gl.bindTexture(gl.TEXTURE_2D, transferFunctionTexture)
  gl.uniform1i(gl.getUniformLocation(program, 'transferFunction'), 3) // 3 == gl.TEXTURE3

  gl.uniform1f(gl.getUniformLocation(program, 'stepSize'), stepSize)

  // This if-statement has to be synchronized with the HTML radio button values as the
  // strings here are the same as the values in those radio buttons.  If new values are
  // added here, the volume rendering shader has to be updated as well
  if (renderType === 'volume') {
    gl.uniform1i(gl.getUniformLocation(program, 'renderType'), 0)
  } else if (renderType === 'entry') {
    gl.uniform1i(gl.getUniformLocation(program, 'renderType'), 1)
  } else if (renderType === 'exit') {
    gl.uniform1i(gl.getUniformLocation(program, 'renderType'), 2)
  } else if (renderType === 'direction') {
    gl.uniform1i(gl.getUniformLocation(program, 'renderType'), 3)
  } else if (renderType === 'transfer') {
    gl.uniform1i(gl.getUniformLocation(program, 'renderType'), 4)
  } else if (renderType === 'slice') {
    gl.uniform1i(gl.getUniformLocation(program, 'renderType'), 5)
  } else if (renderType === 'slice-transfer') {
    gl.uniform1i(gl.getUniformLocation(program, 'renderType'), 6)
  }

  // This if statement has to be synchronized with the HTML radio button values as the
  // strings here are the same as the values in those radio buttons.  If new values are
  // added here, the volume rendering shader has to be updated as well
  if (compositingType === 'ftb') {
    gl.uniform1i(gl.getUniformLocation(program, 'compositingMethod'), 0)
  } else if (compositingType === 'fhp') {
    gl.uniform1i(gl.getUniformLocation(program, 'compositingMethod'), 1)
  } else if (compositingType === 'mip') {
    gl.uniform1i(gl.getUniformLocation(program, 'compositingMethod'), 2)
  }

  // Trigger the volume rendering by rendering the 2 triangles (= 6 vertices) that/
  // comprise the screen-aligned quad.  The positions of the vertices are hard-coded in
  // the shader, so there is no need to worry about vertex buffer objects
  gl.drawArrays(gl.TRIANGLES, 0, 6)
}

/// Main function to be executed after the page has been loaded.  This will cause the
/// loading of the assets and trigger the render loop that will continuously update the
/// rendering.  This function is marked as async as our 'fetch' request to get the volume
/// data requires this.
let gl = null
export async function main (foo, foo2) {
  const canvas = document.querySelector('#glCanvas')
  console.log(canvas)
  gl = canvas.getContext('webgl2')
  console.log(gl)
  // Get a WebGL 2.0 context from the canvas

  // Get the canvas object from the main document

  // WebGL 2 is not supported on many browsers yet
  if (!gl) {
    postError('Error initializing WebGL2 context')
    return
  }

  console.log(100, 'WebGL2 canvas created successfully')

  //
  //   Initialize the shader programs
  //
  console.log(101, 'Creating bounding box OpenGL program object')
  const boundingBoxProgram = createProgram(
    gl, boundingBoxVertexSource, boundingBoxFragmentSource
  )

  console.log(102, 'Creating volume rendering OpenGL program object')
  const volumeRenderingProgram = createProgram(
    gl, volumeRenderingVertexSource, volumeRenderingFragmentSource
  )

  // If either program failed to compile or link, it has already printed an error
  if (!boundingBoxProgram || !volumeRenderingProgram) {
    return
  }

  console.log(103, 'Both program objects were created successfully')

  //
  //   General setup for the OpenGL context
  //
  // Set the clear color to black with full opaqueness
  gl.clearColor(0.0, 0.0, 0.0, 1.0)

  //
  //   Creating intermediate framebuffer
  //
  // We create two framebuffers to render the entry and exit points into so that they are
  // available during the volume rendering

  console.log(104, 'Creating the entry point texture')
  // Create a new OpenGL texture
  const entryTexture = gl.createTexture()
  // Make the next texture the current 2D texture
  gl.bindTexture(gl.TEXTURE_2D, entryTexture)

  // Allocate the space for the texture;  the 'null' in the data causes the data to be
  // reserved, but we don't have to specify any specific data to use
  gl.texImage2D(
    gl.TEXTURE_2D, // texture type
    0, // mip-map level
    gl.RGB, // internal format
    canvas.width, // texture width
    canvas.height, // texture height
    0, // border value
    gl.RGB, // format
    gl.UNSIGNED_BYTE, // type
    null // data
  )

  // We want to do linear interpolation with this texture
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  // It shouldn't happen that we are accessing the texture outside the range, but these
  // value need to be set in order to make OpenGL happy
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  console.log(105, 'Creating the entry point frame buffer object')
  // Create the actual framebuffer for the entry points
  const entryFramebuffer = gl.createFramebuffer()
  // Make this framebuffer the currently active one
  gl.bindFramebuffer(gl.FRAMEBUFFER, entryFramebuffer)
  // Attach the previously created texture to this framebuffer
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0, // attachment position in the framebuffer
    gl.TEXTURE_2D, // texture type
    entryTexture, // target texture
    0 // mip-map level at which to attach the texture
  )

  console.log(106, 'Creating the exit point texture')
  // Now do the same thing for the exit texture
  const exitTexture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, exitTexture)

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, canvas.width, canvas.height, 0, gl.RGB,
    gl.UNSIGNED_BYTE, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  console.log(107, 'Creating the exit point frame buffer')
  const exitFramebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, exitFramebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D,
    exitTexture, 0)

  // Reset the framebuffer to the browser-provided one just in case
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  //
  //   Create the texture that holds the transfer function
  //
  console.log(108, 'Creating the transfer function texture')
  const transferFunctionTexture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, transferFunctionTexture)
  // We hard-code the resolution of the transfer function to 256 pixels
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)

  // Set the texture parameters that are required by OpenGL
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  //
  //   Load the volume data
  //
  console.log(109, 'Creating the texture holding the volume')
  const volumeTexture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_3D, volumeTexture)
  const modelMatrix = mat4.create()
  {
    // Download the pig.raw file from the local server
    console.log(110, "Downloading 'pig.raw' from 'localhost'")
    let response
    try {
      response = await window.fetch('pig.raw')
    } catch (error) {
      // Something went wrong, so we have to bail
      postError("Error accessing volume 'pig.raw': " + error)
      return
    }
    if (!response.ok) {
      // The fetch request didn't fail catastrophically, but it still didn't succeed
      postError("Error accessing volume 'pig.raw'")
      return
    }

    // Access the response payload as a binary data blob
    console.log(111, 'Accessing the blob data from the response')
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

    // The volume size also comes from the available meta data for the pig.raw
    // if you want to have a look at the metadata, the pig.dat contains that
    const volumeSize = [512, 512, 134]

    // console.log(volumeSize[0])
    // gl.UNSIGNED_BYTE
    console.log(115, 'Upload the volume to the GPU')
    gl.texImage3D(
      gl.TEXTURE_3D, // 3D texture -> volume
      0, // the mipmap level, still 0
      gl.R8, // the texture should only have a single component
      volumeSize[0], // x dimension of the volume
      volumeSize[1], // y dimension of the volume
      volumeSize[2], // z dimension of the volume
      0, // value used for the border voxels
      gl.RED, // only a single component, and that is Red
      gl.UNSIGNED_BYTE, // each voxel is represented by a single unsigned byte
      convertedData // the volume data
    )

    // Compute the model matrix for this data set.  These values are all also part of the
    // meta data for this data set (see the .dat file, if you are interested in them)
    mat4.rotate(modelMatrix, modelMatrix, 3 * Math.PI / 2, [1.0, 0.0, 0.0])
    mat4.scale(modelMatrix, modelMatrix, [1.0, 1.0, 0.7052631578947368])
  }
  // We need to specify these parameters to make the texture well formed in the eyes of
  // OpenGL, compared to all the other times, now we also need to specify the wrapping
  // behavior of the R (the third texture dimension) component
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE)

  // Create the projection matrix
  const projectionMatrix = mat4.create()
  {
    const fieldOfView = 45 * 2.0 * Math.PI / 360.0 // 45 degrees in radians
    const aspectRatio = gl.canvas.clientWidth / gl.canvas.clientHeight // assuming > 1.0
    const zNear = 0.1 // Near clipping plane
    const zFar = 100.0 // Far clipping plane

    // Use a convenience method to create a perspective matrix for the bounding box
    mat4.perspective(projectionMatrix, fieldOfView, aspectRatio, zNear, zFar)
  }

  //
  //   Rendering
  //
  function internalRender () {
    // If for whatever reason the transfer function is dirty, create the new data
    // representation and upload to the texture
    if (TransferFunctionIsDirty) {
      updateTransferFunction(gl, transferFunctionTexture)
      TransferFunctionIsDirty = false

      // If we update the transfer function, that also implies that the rendering has
      // changed
      RenderingIsDirty = true
    }

    // If the rendering is not dirty, nothing has changed since the last animationframe
    // that would warrant a rerender, so we just queue ourselves up again and yield now
    if (!RenderingIsDirty) {
      window.requestAnimationFrame(internalRender)
      return
    }

    const viewMatrix = mat4.create()
    {
      // Compute the camera location by converting spherical coordinates into cartesian
      const r = document.getElementById('camera-r').value / 10.0
      const phi = document.getElementById('camera-phi').value

      // The values from the sliders are in Degrees, but the trig functions want radians
      const phiRad = phi * Math.PI / 180.0
      const theta = document.getElementById('camera-theta').value
      const thetaRad = theta * Math.PI / 180.0

      // Conversion from spherical coordinates into cartesian
      const x = r * Math.sin(thetaRad) * Math.cos(phiRad)
      const y = r * Math.sin(thetaRad) * Math.sin(phiRad)
      const z = r * Math.cos(thetaRad)

      // And finally using a helper function to create the correct look-at matrix
      mat4.lookAt(viewMatrix, [x, y, z], [0, 0, 0], [0, 0, 1])
    }

    // First render the bounding box entry and exit points.  These will be rendered into
    // the textures that back the 'entryFramebuffer' and 'exitFramebuffer' framebuffers
    renderBoundingbox(gl, boundingBoxProgram, modelMatrix, viewMatrix, projectionMatrix,
      entryFramebuffer, exitFramebuffer)

    // Get the step size from the slider and rescale to get into a proper range
    const stepSize = 1.0 / document.getElementById('stepSize').value
    const compositing = document.querySelector('input[name="compositing"]:checked').value
    const renderType = document.querySelector('input[name="debug-output"]:checked').value
    renderVolume(gl, volumeRenderingProgram, volumeTexture, entryTexture, exitTexture,
      transferFunctionTexture, stepSize, compositing, renderType)

    // Request a new frame from the browser using us as the callback this will cause the
    // rendering to loop and be constantly updated
    window.requestAnimationFrame(internalRender)

    // We are done with the rendering, so it is by definition not dirty anymore
    RenderingIsDirty = false
  }

  // Request the first frame, thus starting the render loop
  console.log(116, 'Trigger the initial rendering')
  window.requestAnimationFrame(internalRender)
}

// This function has to be called in order to trigger a rerender.  Otherwise, we would
// render the same thing over and over and would kill each laptop's battery superfast.
// So DON'T FORGET to call this if you do something that would change the rendering.
// However, if you are only changing the transfer function, call the
// 'triggerTransferFunctionUpdate' instead as it will implicitly trigger a rendering
// update as well
export function triggerRendering () {
  RenderingIsDirty = true
}

// This function has to be called in order to trigger an update of the transfer fucntion,
// similar to the triggerRendering method, we only upload the transfer function data to
// the GPU when triggered by the user interface to save on processing resources.  So DON'T
// FORGET to call this function if you are updating the transfer function or your changes
// won't be visible.
function triggerTransferFunctionUpdate () {
  TransferFunctionIsDirty = true
}

// Signals an error to the user
function postError (msg) {
  document.getElementById('error').innerHTML =
    document.getElementById('error').innerHTML + '<p>' + msg + '</p>'
}
