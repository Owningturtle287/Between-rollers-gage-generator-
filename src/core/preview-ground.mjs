import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, ShadowMaterial } from 'three';

/** Screen-space derivatives filter lines; subpixel/grazing lines fade instead of shimmering. */
export const gridFragmentShader=`
  uniform vec3 gridColor;
  uniform float cellSize;
  uniform float fadeRadius;
  varying vec3 worldPosition;
  float gridLines(float spacing) {
    vec2 cell=worldPosition.xy/spacing;
    vec2 footprint=max(fwidth(cell),vec2(0.00001));
    vec2 distanceToLine=abs(fract(cell+0.5)-0.5);
    vec2 coverage=1.0-smoothstep(vec2(0.0),footprint,distanceToLine);
    vec2 resolved=1.0-smoothstep(vec2(0.08),vec2(0.22),footprint);
    return max(coverage.x*resolved.x,coverage.y*resolved.y);
  }
  void main() {
    float minor=gridLines(cellSize);
    float major=gridLines(cellSize*5.0);
    float facing=abs(normalize(cameraPosition-worldPosition).z);
    float edgeFade=smoothstep(0.035,0.16,facing);
    float distanceFade=1.0-smoothstep(fadeRadius*0.65,fadeRadius,length(worldPosition.xy));
    float alpha=max(minor*0.19,major*0.29)*edgeFade*distanceFade;
    gl_FragColor=vec4(gridColor,alpha);
    #include <colorspace_fragment>
  }
`;

export function createPreviewGround(){
  const geometry=new PlaneGeometry(1,1);
  const floor=new Mesh(geometry,new ShadowMaterial({color:'#244b48',opacity:.13,depthWrite:false,depthTest:true,side:DoubleSide}));
  const grid=new Mesh(geometry,new ShaderMaterial({
    uniforms:{gridColor:{value:new Color('#76938a')},cellSize:{value:5},fadeRadius:{value:250}},
    vertexShader:`varying vec3 worldPosition; void main(){vec4 world=modelMatrix*vec4(position,1.0);worldPosition=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:gridFragmentShader,transparent:true,depthWrite:false,depthTest:true,side:DoubleSide,toneMapped:false,
  }));
  floor.name='Ground shadow';floor.receiveShadow=true;floor.renderOrder=0;
  grid.name='Antialiased grid';grid.renderOrder=1;
  return {floor,grid,update(layout){
    for(const mesh of [floor,grid]){mesh.position.z=layout.groundZ;mesh.scale.set(layout.gridSize,layout.gridSize,1);}
    grid.material.uniforms.cellSize.value=layout.gridStep;
    grid.material.uniforms.fadeRadius.value=layout.gridFadeRadius;
  },dispose(){geometry.dispose();floor.material.dispose();grid.material.dispose();}};
}
