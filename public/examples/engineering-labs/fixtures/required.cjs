const requiredAnnotationsRegex = /\s*@Not(Blank|Null|Empty)\b[^;]*/
const sizeAnnotationRegex = /\s*@Size\s*\(\s*[^)]*min\s*=\s*(\d+)[^)]*\)/
function isFieldRequired(annotationStr = '') {
  // 检查是否有必填注解
  if (requiredAnnotationsRegex.test(annotationStr)) {
    return true
  }

  // 检查 @Size 注解
  let match
  const regex = new RegExp(sizeAnnotationRegex)
  while ((match = regex.exec(annotationStr)) !== null) {
    const minValue = parseInt(match[1], 10)
    if (minValue > 0) {
      return true
    }
  }
  return false
}
module.exports={isFieldRequired};
