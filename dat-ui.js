/* Independent DAT overlay: does not replace PNS/PSH reports. */
(function(){
'use strict';
const state={points:[],name:'',markers:L.layerGroup().addTo(map),fill:null,lines:null,features:[],labels:[],token:0,ready:false,canvas:null,bounds:null,timer:null,pending:false,loadToken:0};
map.createPane('datPoints');map.getPane('datPoints').style.zIndex=640;
map.createPane('datDensity');map.getPane('datDensity').style.zIndex=450;map.getPane('datDensity').style.pointerEvents='none';
map.createPane('datContours');map.getPane('datContours').style.zIndex=570;map.getPane('datContours').style.pointerEvents='none';
const legend=L.control({position:'bottomleft'});legend.onAdd=()=>{const n=L.DomUtil.create('div','dat-legend');n.id='datLegend';n.hidden=true;L.DomEvent.disableClickPropagation(n);return n;};legend.addTo(map);
const note=s=>$('datStatus').textContent=s;
function selected(){return state.points.filter(p=>$(p.type==='tropical'?'datTropical':p.type==='tornado'?'datTornado':'datOther').checked);}
function size(){return Number($('datSize').value);}
function updateLegend(){
 const points=selected();$('datLegend').hidden=!state.points.length;
 const types=[...new Map(points.map(p=>[p.type==='tornado'?p.rating:p.type,p])).values()];
 $('datLegend').innerHTML='<strong>DAT survey points</strong><br>'+types.map(p=>'<span style="color:'+p.color+'">'+(p.type==='tornado'?'▼':'●')+'</span> '+esc(p.type==='tropical'?'Tropical wind':p.type==='tornado'?p.rating:'Other / unrated')).join('<br>')+'<div class="note">'+points.length+' selected reports'+(state.ready&&$('datDensityOn').checked?'<br>Density: survey points/km²<br>Smoothing: '+$('datBandwidth').value+' km':'')+'</div>';
}
function renderPoints(){
 state.markers.clearLayers();$('datSizeValue').textContent=size()+' px';
 if($('datShow').checked)selected().forEach(p=>{
  const symbol=p.type==='tornado'?'<svg width="'+size()+'" height="'+size()+'" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 3 L22 3 L12 22 Z" fill="'+p.color+'" stroke="#263344" stroke-width="1.6"/></svg>':'<svg width="'+size()+'" height="'+size()+'" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="'+p.color+'" stroke="#263344" stroke-width="1.6"/></svg>';
  const marker=L.marker([p.lat,displayLon(p.lon)],{pane:'datPoints',bubblingMouseEvents:false,icon:L.divIcon({className:'dat-point',html:symbol,iconSize:[size(),size()],iconAnchor:[size()/2,size()/2]})});
  marker.bindPopup('<strong>'+esc(p.type==='tropical'?'Tropical wind':p.type==='tornado'?'Tornado — '+p.rating:p.name)+'</strong><br>'+p.lat.toFixed(5)+', '+p.lon.toFixed(5)+'<table class="dat-popup-table">'+Object.entries(p.fields).map(([k,v])=>'<tr><th>'+esc(k)+'</th><td>'+esc(v)+'</td></tr>').join('')+'</table>').addTo(state.markers);
 });updateLegend();
}
function clearDensity(){state.token++;state.ready=false;state.pending=false;if(state.fill){map.removeLayer(state.fill);state.fill=null;}if(state.lines){map.removeLayer(state.lines);state.lines=null;}state.features=[];state.labels=[];state.canvas=null;state.bounds=null;}
async function density(){
 clearDensity();const points=selected(),token=state.token;if(!$('datDensityOn').checked||!points.length){updateLegend();note(points.length+' selected DAT points. Density is '+($('datDensityOn').checked?'waiting for points.':'off.'));return;}state.pending=true;
 note('Calculating DAT survey-point density…');
 const field=DatTools.densitySetup(points,Number($('datBandwidth').value)),bounds=L.latLngBounds([field.south,field.west],[field.north,field.east]),nw=map.project(bounds.getNorthWest(),0),se=map.project(bounds.getSouthEast(),0),width=256,height=Math.max(64,Math.min(384,Math.round(width*(se.y-nw.y)/(se.x-nw.x))));
 const xs=Array.from({length:width},(_,x)=>map.unproject(L.point(nw.x+(x+.5)/width*(se.x-nw.x),nw.y),0).lng),ys=Array.from({length:height},(_,y)=>map.unproject(L.point(nw.x,nw.y+(y+.5)/height*(se.y-nw.y)),0).lat),values=new Float32Array(width*height);let max=0;
 for(let y=0;y<height;){const end=Math.min(height,y+8);for(;y<end;y++)for(let x=0;x<width;x++){const v=field.estimate(ys[y],xs[x]);values[y*width+x]=v;max=Math.max(max,v);}await new Promise(r=>setTimeout(r,0));if(token!==state.token)return;}
 if(!(max>0)){state.pending=false;note('No density captured at this grid scale. Increase smoothing or use a smaller geographic dataset.');updateLegend();return;}
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d'),img=ctx.createImageData(width,height),stops=paletteRgb([[0,'#fff7bc'],[.25,'#fec44f'],[.5,'#f03b20'],[.75,'#bd0026'],[1,'#4d0025']]);
 for(let i=0;i<values.length;i++){if(values[i]<max*.005)continue;const c=gradientRgb(values[i]/max,stops);img.data.set([...c,255],i*4);}ctx.putImageData(img,0,0);
 const requested=Number($('datInterval').value),interval=requested>0?requested:DatTools.niceInterval(max),actual=Math.max(interval,max/100),features=[],labels=[];
 if($('datDensityContours').checked)for(let level=actual;level<=max;level+=actual){
  const paths=contourPaths(values,width,height,level),coords=paths.map(path=>path.map(([x,y])=>{const ix=Math.min(width-2,Math.floor(x)),iy=Math.min(height-2,Math.floor(y));return [xs[ix]+(xs[ix+1]-xs[ix])*(x-ix),ys[iy]+(ys[iy+1]-ys[iy])*(y-iy)];}));
  if(coords.length){features.push({type:'Feature',properties:{density:level},geometry:{type:'MultiLineString',coordinates:coords}});const path=coords.reduce((a,b)=>a.length>b.length?a:b);if(path.length>15){const q=path[Math.floor(path.length/2)];labels.push({lon:q[0],lat:q[1],text:Number(level.toPrecision(3))+'/km²'});}}
  await new Promise(r=>setTimeout(r,0));if(token!==state.token)return;
 }
 if(token!==state.token)return;state.canvas=canvas;state.bounds=bounds;state.features=features;state.labels=labels;state.ready=true;state.pending=false;
 if($('datDensityFill').checked)state.fill=L.imageOverlay(canvas.toDataURL(),bounds,{pane:'datDensity',interactive:false,opacity:Number($('datOpacity').value)/100,className:'blended-fill'}).addTo(map);
 state.lines=L.layerGroup().addTo(map);
 if(features.length)L.geoJSON({type:'FeatureCollection',features},{pane:'datContours',interactive:false,style:{color:'#4a1738',weight:1.3,opacity:.9}}).addTo(state.lines);
 const boxes=[];labels.forEach(p=>{const q=map.latLngToContainerPoint([p.lat,displayLon(p.lon)]);if(boxes.some(b=>Math.abs(b.x-q.x)<85&&Math.abs(b.y-q.y)<20))return;boxes.push(q);L.marker([p.lat,displayLon(p.lon)],{pane:'datContours',interactive:false,icon:L.divIcon({className:'contour-label',html:esc(p.text),iconSize:[100,18],iconAnchor:[40,9]})}).addTo(state.lines);});
 updateLegend();note(points.length+' DAT points; peak density '+Number(max.toPrecision(3))+'/km². Contour interval '+Number(actual.toPrecision(3))+'/km².'+(requested>0&&actual>requested?' Interval increased to keep at most 100 contour levels.':''));
}
function queueDensity(){clearDensity();clearTimeout(state.timer);state.timer=setTimeout(()=>density().catch(e=>{state.pending=false;note(e.message);}),180);}
$('datLoad').onclick=async()=>{
 const loading=++state.loadToken;try{const file=$('datFile').files[0];$('datLoad').disabled=true;note('Reading DAT KML/KMZ…');const result=await DatTools.readFile(file);if(loading!==state.loadToken)return;state.points=result.points;state.name=file.name;renderPoints();queueDensity();note(result.points.length+' DAT points imported: '+(result.counts.tropical||0)+' tropical, '+(result.counts.tornado||0)+' tornado, '+(result.counts.other||0)+' other/unrated. '+result.skipped+' invalid coordinates skipped.');}
 catch(e){note(e.message);}finally{$('datLoad').disabled=false;}
};
$('datClear').onclick=()=>{state.loadToken++;state.points=[];state.name='';clearTimeout(state.timer);clearDensity();renderPoints();note('DAT overlay cleared.');};
$('datFit').onclick=()=>{const points=selected();if(points.length)map.fitBounds(L.latLngBounds(points.map(p=>[p.lat,displayLon(p.lon)])),{padding:[25,25],maxZoom:13});else note('Import DAT points and select a type first.');};
$('datSize').oninput=renderPoints;$('datShow').onchange=renderPoints;
['datTropical','datTornado','datOther'].forEach(id=>$(id).onchange=()=>{renderPoints();queueDensity();});
['datDensityOn','datDensityContours','datDensityFill','datBandwidth','datInterval'].forEach(id=>$(id).onchange=queueDensity);
$('datOpacity').oninput=()=>{$('datOpacityValue').textContent=$('datOpacity').value+'%';if(state.fill)state.fill.setOpacity(Number($('datOpacity').value)/100);};
function drawDensity(ctx,project){
 if(!state.ready||!$('datDensityOn').checked)return;
 if(state.canvas&&state.bounds&&$('datDensityFill').checked){const a=project(state.bounds.getWest(),state.bounds.getNorth()),b=project(state.bounds.getEast(),state.bounds.getSouth());ctx.save();ctx.globalAlpha=Number($('datOpacity').value)/100;ctx.drawImage(state.canvas,a[0],a[1],b[0]-a[0],b[1]-a[1]);ctx.restore();}
 if($('datDensityContours').checked){ctx.save();ctx.strokeStyle='#4a1738';ctx.lineWidth=1.2;state.features.forEach(f=>f.geometry.coordinates.forEach(path=>{ctx.beginPath();path.forEach((q,i)=>{const z=project(q[0],q[1]);i?ctx.lineTo(...z):ctx.moveTo(...z);});ctx.stroke();}));ctx.font='11px Poppins';state.labels.forEach(p=>{const q=project(p.lon,p.lat);ctx.strokeStyle='white';ctx.lineWidth=3;ctx.strokeText(p.text,q[0],q[1]);ctx.fillStyle='#4a1738';ctx.fillText(p.text,q[0],q[1]);});ctx.restore();}
}
function drawPoints(ctx,project){
 if(!$('datShow').checked)return;ctx.save();selected().forEach(p=>{const [x,y]=project(p.lon,p.lat),r=size()/2;ctx.beginPath();if(p.type==='tornado'){ctx.moveTo(x-r,y-r);ctx.lineTo(x+r,y-r);ctx.lineTo(x,y+r);ctx.closePath();}else ctx.arc(x,y,r,0,2*Math.PI);ctx.fillStyle=p.color;ctx.fill();ctx.strokeStyle='#263344';ctx.lineWidth=1;ctx.stroke();});ctx.restore();
}
window.DatOverlay={state,selected,renderPoints,drawDensity,drawPoints};

})();
