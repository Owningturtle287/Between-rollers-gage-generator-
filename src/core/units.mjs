export const toMillimeters=(value,units)=>units==='in'?value*25.4:value;
export const fromMillimeters=(value,units)=>units==='in'?value/25.4:value;
export const formatDimension=(value,units)=>{
  const n=fromMillimeters(value,units);
  return Number.isFinite(n)?(Math.abs(n)<.0000005?0:n).toFixed(6):'—';
};
