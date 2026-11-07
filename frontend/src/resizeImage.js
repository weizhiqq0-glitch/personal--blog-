export async function resizeImage(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('请选择10MB以内的 JPG、PNG 或 WebP 图片');
  const bitmap=await createImageBitmap(file);
  try{const scale=Math.min(1,1600/bitmap.width,1600/bitmap.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);let data=canvas.toDataURL('image/jpeg',.8);if(data.length>699075)data=canvas.toDataURL('image/jpeg',.5);if(data.length>699075)throw Error('图片压缩后仍超过512KB，请选择更小的图片');return data;}finally{bitmap.close();}
}
