export const rgbObjToRgbString = (obj) => {
  return 'rgba(' + obj.r + ', ' + obj.g + ', ' + obj.b + ', ' + obj.a + ')'
}

export const rgbStringToObj = (rgbString) => {
  const nums = rgbString.split(',').map(word => Number(word.replace(/\D/g, '')))
  return { r: nums[0], g: nums[1], b: nums[2], a: 1 }
}
