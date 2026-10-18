/* DAT KML/KMZ parsing and survey-point density. No network links or imported HTML are executed. */
(function(root){
'use strict';
const EF_COLORS={0:'#02fffb',1:'#02ff52',2:'#ffee02',3:'#ffa302',4:'#ff0602',5:'#ff00ff'};
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const elements=(node,name)=>Array.from(node.getElementsByTagNameNS('*',name));
const first=(node,name)=>elements(node,name)[0];
const text=(node,name)=>first(node,name)?.textContent?.trim()||'';
function kmlColor(s){const c=String(s||'').replace(/^#/,'').trim().toLowerCase();return /^[a-f0-9]{8}$/i.test(c)?'#'+c.slice(6,8)+c.slice(4,6)+c.slice(2,4):null;}
function classify(fields,name='',href=''){
 const rating=fields.efrating||fields.enhancedfujitarating||fields.efscale||fields.ef||'';
 const context=[rating,name,fields.eventtype,fields.hazardtype,fields.damagetype].filter(Boolean).join(' ');
 if(/tropical|hurricane/i.test(context))return {type:'tropical',ef:null,rating:'Tropical',color:'#ffdf00'};
 const ef=String(rating||name).match(/\b(?:EF|F)\s*[- ]?\s*([0-5])\b/i)||String(href).match(/(?:^|[\/_-])ef([0-5])(?:[._-]|$)/i);
 if(ef)return {type:'tornado',ef:Number(ef[1]),rating:'EF'+ef[1],color:EF_COLORS[ef[1]]};
 if(/tornado|(?:\bEF[ -]?U\b)/i.test(context))return {type:'tornado',ef:null,rating:'EF unknown',color:'#999999'};
 return {type:/thunderstorm|tstm|straight.line/i.test(context)?'other':'other',ef:null,rating:String(rating||name||'Unrated'),color:'#999999'};
}
function descriptionFields(description,Parser){
 const fields=Object.create(null);if(!description)return fields;
 // Extract table text without loading imported image, iframe or other resource tags.
 const plain=html=>{const safe=html.replace(/<\/?[a-z][^>]*>/gi,' ').replace(/</g,'&lt;');return new Parser().parseFromString('<p>'+safe+'</p>','text/html').documentElement.textContent.replace(/\s+/g,' ').trim();};
 for(const row of String(description).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){const cells=[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)];if(cells.length>=2)fields[norm(plain(cells[0][1]))]=cells.slice(1).map(c=>plain(c[1])).join(' ');}
 return fields;
}
function parseKml(source,Parser=root.DOMParser){
 if(!Parser)throw Error('XML parser unavailable.');if(String(source).length>20*1024*1024)throw Error('KML exceeds the 20 MB limit.');
 if(/<!DOCTYPE|<!ENTITY/i.test(source))throw Error('KML declarations with external entities are not supported.');
 const doc=new Parser().parseFromString(String(source),'application/xml');if(elements(doc,'parsererror').length||doc.documentElement?.localName!=='kml')throw Error('Invalid KML document.');
 const styles=new Map();elements(doc,'Style').concat(elements(doc,'StyleMap')).forEach(n=>{const id=n.getAttribute('id');if(id)styles.set(id,n);});
 function resolve(ref,depth=0){if(!ref||!ref.startsWith('#')||depth>8)return null;const node=styles.get(ref.slice(1));if(!node)return null;if(node.localName==='StyleMap'){const pairs=elements(node,'Pair'),p=pairs.find(p=>text(p,'key')==='normal')||pairs[0];return p?resolve(text(p,'styleUrl'),depth+1):null;}return node;}
 function styleColor(node){if(!node)return null;for(const type of ['IconStyle','LineStyle','PolyStyle']){const n=first(node,type),color=n&&kmlColor(text(n,'color'));if(color)return color;}return null;}
 const points=[];let skipped=0,nonPoints=0;
 for(const placemark of elements(doc,'Placemark')){
  const geometries=elements(placemark,'Point');if(!geometries.length){nonPoints++;continue;}
  const fields=descriptionFields(text(placemark,'description'),Parser);
  elements(placemark,'Data').forEach(n=>{fields[norm(n.getAttribute('name'))]=text(n,'value');});
  elements(placemark,'SimpleData').forEach(n=>{fields[norm(n.getAttribute('name'))]=n.textContent.trim();});
  const name=text(placemark,'name'),style=first(placemark,'Style')||resolve(text(placemark,'styleUrl')),href=style?text(style,'href'):'',kind=classify(fields,name,href);
  const ratingStyle=kind.ef!==null?styles.get('EF'+kind.ef):null;
  const color=kind.type==='tropical'?'#ffdf00':styleColor(ratingStyle)||styleColor(style)||kind.color;
  for(const point of geometries){
   const coord=text(point,'coordinates').split(/\s+/)[0].split(','),lon=Number(coord[0]),lat=Number(coord[1]);
   if(coord.length<2||!coord[0]||!coord[1]||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180){skipped++;continue;}
   points.push({id:points.length,lat,lon,name:name||kind.rating,...kind,color,fields:{...fields}});
   if(points.length>50000)throw Error('Import at most 50,000 DAT points at a time.');
  }
 }
 if(!points.length)throw Error('No valid Point placemarks found in the KML.');
 return {points,skipped,nonPoints,counts:points.reduce((a,p)=>(a[p.type]=(a[p.type]||0)+1,a),{})};
}
async function readFile(file,Zip=root.JSZip,Parser=root.DOMParser){
 if(!file)throw Error('Choose a DAT KML or KMZ file.');if(file.size>25*1024*1024)throw Error('Choose a DAT file smaller than 25 MB.');
 if(/\.kml$/i.test(file.name))return parseKml(await file.text(),Parser);
 if(!/\.kmz$/i.test(file.name))throw Error('Choose a .kml or .kmz file.');
 if(!Zip)throw Error('KMZ reader unavailable. Try the KML inside the archive.');
 const zip=await Zip.loadAsync(await file.arrayBuffer()),entries=Object.values(zip.files).filter(f=>!f.dir&&/\.kml$/i.test(f.name));
 if(!entries.length)throw Error('No KML found in the KMZ.');
 const chosen=entries.find(f=>/^doc\.kml$/i.test(f.name))||entries[0];
 // Read only the main KML; do not load linked files, photographs or network links.
 if(chosen._data?.uncompressedSize>20*1024*1024)throw Error('The KML inside this KMZ exceeds 20 MB.');
 return parseKml(await chosen.async('string'),Parser);
}
function densitySetup(points,bandwidth){
 if(!points.length)throw Error('No selected DAT points.');const h=Number(bandwidth);if(!(h>=.5&&h<=50))throw Error('Density smoothing must be 0.5–50 km.');
 const radians=Math.PI/180,lon0=Math.atan2(points.reduce((s,p)=>s+Math.sin(p.lon*radians),0),points.reduce((s,p)=>s+Math.cos(p.lon*radians),0))/radians,lat0=points.reduce((s,p)=>s+p.lat,0)/points.length,cos=Math.max(.05,Math.cos(lat0*radians)),wrap=lon=>lon0+(((lon-lon0+180)%360+360)%360-180);
 const project=(lat,lon)=>[(wrap(lon)-lon0)*111.2*cos,(lat-lat0)*111.2],unproject=(x,y)=>[lon0+x/(111.2*cos),lat0+y/111.2],radius=3*h,bins=new Map(),locations=points.map(p=>project(p.lat,p.lon));
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;locations.forEach(([x,y])=>{minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);const key=Math.floor(x/radius)+','+Math.floor(y/radius);if(!bins.has(key))bins.set(key,[]);bins.get(key).push([x,y]);});
 function estimate(lat,lon){const [x,y]=project(lat,lon),bx=Math.floor(x/radius),by=Math.floor(y/radius);let sum=0;for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const bucket=bins.get((bx+i)+','+(by+j));if(bucket)for(const [px,py] of bucket){const d2=(x-px)**2+(y-py)**2;if(d2<=radius*radius)sum+=Math.exp(-d2/(2*h*h));}}return sum/(2*Math.PI*h*h);}
 const sw=unproject(minX-radius,minY-radius),ne=unproject(maxX+radius,maxY+radius);sw[1]=Math.max(-85,sw[1]);ne[1]=Math.min(85,ne[1]);
 return {estimate,west:sw[0],south:sw[1],east:ne[0],north:ne[1],bandwidth:h};
}
function niceInterval(max){if(!(max>0))return 1;const target=max/6,unit=10**Math.floor(Math.log10(target));return [1,2,5,10].map(x=>x*unit).find(x=>x>=target);}
root.DatTools={parseKml,readFile,kmlColor,classify,densitySetup,niceInterval,EF_COLORS};
if(typeof module!=='undefined')module.exports=root.DatTools;
})(globalThis);
