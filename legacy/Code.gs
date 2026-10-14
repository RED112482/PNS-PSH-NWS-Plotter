/** NWS PNS Plotter v15 — Apps Script V8. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('NWS PNS Plotter').addMetaTag('viewport','width=device-width, initial-scale=1');
}
function productUrl_(input, format) {
  var m=String(input||'').trim().match(/^https:\/\/forecast\.weather\.gov\/product\.php\?([^#]*)$/i);
  if(!m) throw new Error('Use an HTTPS forecast.weather.gov/product.php PNS link.');
  var q={};m[1].replace(/&amp;/g,'&').split('&').forEach(function(p){var a=p.split('=');q[a[0]]=decodeURIComponent(a.slice(1).join('='));});
  if(String(q.product).toUpperCase()!=='PNS')throw new Error('Use a PNS product link.');
  var office=office_(q.issuedby||q.site);
  var v=Number(q.version||1);if(!Number.isInteger(v)||v<1||v>50)throw new Error('Version must be 1–50.');
  return 'https://forecast.weather.gov/product.php?site='+office+'&issuedby='+office+'&product=PNS&format='+format+'&version='+v+'&glossary=0';
}
function readProduct_(url) {
  var response=UrlFetchApp.fetch(url,{muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw new Error('NWS returned HTTP '+response.getResponseCode());
  var html=response.getContentText(),pre=html.match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/i);
  if(!pre)throw new Error('No product text found. Paste the PNS or metadata instead.');
  return pre[1].replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"');
}
function signature_(text) {
  return (text.match(/^\s*[A-Z]{4}\d{2}\s+[A-Z]{4}\s+\d{6}[^\n]*/m)||[''])[0].trim()+'|'+(text.match(/^.*(?:AM|PM)\s+[A-Z]{2,4}.*$/m)||[''])[0].trim();
}
function fetchPns(input) {
  // The text-only page preserves the **METADATA** block, which CI can omit.
  var url=productUrl_(input,'txt'),text=readProduct_(url),meta=parseMetadata_(text),note='';
  if(!meta.detected) {
    try {
      var alternate=readProduct_(productUrl_(input,'CI'));
      if(signature_(text)!==signature_(alternate))note='The version changed while checking alternate format; that different issuance was not combined.';
      else if(parseMetadata_(alternate).detected){text=alternate;url=productUrl_(input,'CI');}
    } catch(e){note='Alternate format check failed: '+String(e.message||e);}
  }
  var result=parsePns_(text);result.url=url;result.office=officeFromUrl_(url);result.metadata.searchNote=note;return result;
}
function parsePns(text,office) {return parsePns_(String(text).slice(0,250000),undefined,office);}
function key_(name,provider,office) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,office_(office||'MOB')+'|'+String(name).trim().toLowerCase()+'|'+String(provider).trim().toLowerCase()));
}
function legacyKey_(name,provider){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(name).trim().toLowerCase()+'|'+String(provider).trim().toLowerCase()));}
function convert_(value,unit,kind) {
  var u=String(unit).toUpperCase().replace(/[.\s]/g,'');
  if(!Number.isFinite(value)||value<0)return null;
  if(kind==='wind'){if(/^(KT|KTS|KNOT|KNOTS)$/.test(u))value*=1.150779;else if(/^(KM\/H|KPH|KMH)$/.test(u))value/=1.609344;else if(/^(M\/S|MPS)$/.test(u))value*=2.236936;else if(u!=='MPH')return null;}
  else {if(/^(MM|MILLIMETER|MILLIMETERS)$/.test(u))value/=25.4;else if(/^(CM|CENTIMETER|CENTIMETERS)$/.test(u))value/=2.54;else if(!/^(IN|INCH|INCHES)$/.test(u))return null;}
  return Number(value.toFixed(2));
}
function metadataKind_(code) {
  if(/WIND|GUST/i.test(code))return 'wind';if(/SNOW/i.test(code))return 'snow';if(/HAIL/i.test(code))return 'hail';if(/RAIN|PRECIP/i.test(code))return 'rain';return null;
}
function validPosition_(lat,lon) {return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;}
function csvFields_(line) {
  var a=[],field='',quoted=false;
  for(var i=0;i<line.length;i++){var c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){a.push(field.trim());field='';}else field+=c;}
  if(quoted)throw new Error('Unclosed CSV quote');a.push(field.trim());return a;
}
function parseMetadata_(text) {
  var result={detected:/\*\*\s*METADATA\s*\*\*/i.test(text),records:[],invalid:0,unsupported:0,total:0},seen={};
  String(text).split(/\r?\n/).forEach(function(line){
    if(!/^\s*:\d{1,2}\/\d{1,2}\/\d{4}\s*,/.test(line))return;
    result.detected=true;result.total++;
    try {
      var a=csvFields_(line.trim().slice(1));if(a.length<14)throw new Error('Too few fields');
      var code=a[9].toUpperCase(),kind=metadataKind_(code);if(!kind){result.unsupported++;return;}
      if(!a[7]||!a[8]||!a[10]||!a[4])throw new Error('Missing value/coordinate');
      var lat=Number(a[7]),lon=Number(a[8]),value=convert_(Number(a[10]),a[11],kind);
      if(!validPosition_(lat,lon)||value===null)throw new Error('Invalid value/coordinate/unit');
      var row={name:a[4],value:value,kind:kind,unit:kind==='wind'?'mph':'in',provider:a[12],time:a[1]+' '+a[0],date:a[0],county:a[3],state:a[2],lat:lat,lon:lon,confirmed:true,locationSource:'PNS metadata',reportCode:code,description:a[13],group:kind+'|'+code};
      var k=JSON.stringify([a[0],a[1],lat,lon,code,value,a[12],a[4]]);if(!seen[k]){seen[k]=true;result.records.push(row);}
    }catch(e){result.invalid++;}
  });return result;
}
function normalizedName_(s){return String(s).toLowerCase().replace(/\([^)]*\)/g,'').replace(/\s+/g,' ').trim();}
function timeKey_(s){return String(s).replace(/\b(\d{1,2}\/\d{1,2})\/\d{4}\b/g,'$1').replace(/\s+/g,'').toUpperCase();}
function sameReport_(a,b) {
  return a.kind===b.kind&&Math.abs(a.value-b.value)<.011&&normalizedName_(a.name)===normalizedName_(b.name)&&String(a.provider).trim().toUpperCase()===String(b.provider).trim().toUpperCase()&&(!a.time||timeKey_(a.time)===timeKey_(b.time));
}
function parsePns_(text, supplemental, office) {
  office=office_(office||((text.match(/^\s*PNS([A-Z]{3})\s*$/m)||[])[1])||'MOB');
  var rows=[],section='',county='',state='',headline=(text.match(/\.{3}([^\n]+?)\.{3}/)||[])[1]||'Public Information Statement';
  // Parse the visible table too, preserving reports missing from the metadata.
  text.split(/\r?\n/).forEach(function(line){
    if(/^\s*\.{3}/.test(line)){section=line.replace(/\./g,'').trim();var cm=section.match(/^(.+?) County(?:\s|$)/i);if(cm)county=cm[1];var sm=section.match(/^(Alabama|Florida|Mississippi)$/i);if(sm)state=sm[1];}
    var m=line.match(/^\s*(.+?)\s{2,}(\d+(?:\.\d+)?)\s*(MPH|KTS?|KT|IN(?:CHES)?|IN\.|MM|CM)\b\.?\s*(.*)$/i);if(!m)return;
    var kind=/MPH|KT/i.test(m[3])?'wind':/snow/i.test(section)?'snow':/hail/i.test(section)?'hail':'rain',tail=m[4],coords=tail.match(/\b(\d{2}\.\d+)\s*(?:N|,)\s*(?:\/\s*)?(-?\d{2,3}\.\d+)\s*W?\b/i);
    var tm=(tail.match(/\b\d{3,4}\s*[AP]M\s+\d{1,2}\/\d{1,2}\b/i)||[])[0]||'',provider=tail.replace(tm,'').replace(coords?coords[0]:'','').trim();
    var row={name:m[1].trim(),value:convert_(Number(m[2]),m[3],kind),kind:kind,unit:kind==='wind'?'mph':'in',provider:provider,time:tm,date:'',county:county,state:state,lat:null,lon:null,confirmed:false,locationSource:'unlocated',reportCode:'',description:'',group:kind+'|table'};
    if(coords){var lat=Number(coords[1]),lon=-Math.abs(Number(coords[2]));if(validPosition_(lat,lon)){row.lat=lat;row.lon=lon;row.confirmed=true;row.locationSource='PNS coordinates';}}
    rows.push(row);
  });
  var metadata=parseMetadata_(supplemental===undefined?text:supplemental),unmatched=rows,matched=0;
  if(metadata.records.length){
    unmatched=rows.filter(function(r){if(metadata.records.some(function(m){return sameReport_(r,m);})){matched++;return false;}return true;});
    if(supplemental!==undefined&&rows.length&&!matched)throw new Error('Pasted metadata does not match any loaded report by name, provider, value and time. Use Plot metadata only to load it as a separate dataset.');
    // Metadata rows are authoritative: no town geocoding, no saved-location override.
    rows=metadata.records.concat(unmatched);
  }
  rows.forEach(function(row,i){row.id=i;row.office=office;if(row.confirmed)return;var saved=PropertiesService.getScriptProperties().getProperty('loc_'+key_(row.name,row.provider,office));if(!saved&&office==='MOB')saved=PropertiesService.getScriptProperties().getProperty('loc_'+legacyKey_(row.name,row.provider));if(saved){try{var s=JSON.parse(saved);if(validPosition_(s.lat,s.lon)){row.lat=s.lat;row.lon=s.lon;row.confirmed=true;row.locationSource='saved location';}}catch(e){}}});
  if(!rows.length)throw new Error(metadata.detected?'Metadata found, but no supported records have valid coordinates and values on Earth.':'No supported numeric reports or metadata found.');
  var found=metadata.records.length;
  return {headline:headline,issued:(text.match(/^.*(?:AM|PM)\s+[A-Z]{2,4}.*$/m)||[])[0]||'',text:text,office:office,rows:rows,metadata:{found:found>0,detected:metadata.detected,total:metadata.total,count:found,invalid:metadata.invalid,unsupported:metadata.unsupported,unmatched:metadata.records.length?unmatched.length:rows.length,matched:matched,source:supplemental===undefined?'product':'pasted',message:found?'Metadata found: '+found+' valid records with coordinates.':metadata.detected?'Metadata block found, but no supported valid records.':'No metadata found in this product. Paste supplemental metadata below or place reports manually.'}};
}
function applyMetadata(text,metadata,office) {
  text=String(text).slice(0,250000);metadata=String(metadata).slice(0,250000);
  var pasted=parseMetadata_(metadata);
  if(!pasted.records.length)throw new Error('No supported valid metadata rows in the pasted text.');
  // Reject an unrelated supplement even if the original product already has metadata.
  var existing=parsePns_(text,undefined,office).rows;
  if(existing.length&&!existing.some(function(r){return pasted.records.some(function(m){return sameReport_(r,m);});}))throw new Error('Pasted metadata does not match the loaded product by report name, provider, value and time. Use Plot metadata only for a separate dataset.');
  var originalLines=text.split(/\r?\n/).filter(function(l){return /^\s*:\d{1,2}\/\d{1,2}\/\d{4}\s*,/.test(l);}).join('\n');
  return parsePns_(text,originalLines+'\n'+metadata,office);
}
function suggestLocations(rows,bounds) {
  if(!Array.isArray(rows)||rows.length>10)throw new Error('Request at most 10 locations.');
  return rows.map(function(r){
    try {
      var query=String(r.name).slice(0,100)+(r.county?' '+r.county+' County':'')+(r.state?' '+r.state:' USA');
      var geocoder=Maps.newGeocoder().setRegion('us');
      if(bounds&&bounds.length===4&&bounds.every(function(n){return Number.isFinite(n);}))geocoder.setBounds(bounds[1],bounds[0],bounds[3],bounds[2]);
      var g=geocoder.geocode(query);
      var candidates=(g.results||[]).filter(function(x){var p=x.geometry.location;return !bounds||(p.lat>=bounds[1]&&p.lat<=bounds[3]&&p.lng>=bounds[0]&&p.lng<=bounds[2]);}).slice(0,3).map(function(x){return {lat:x.geometry.location.lat,lon:x.geometry.location.lng,label:x.formatted_address};});
      return {id:r.id,candidates:candidates};
    }catch(e){return {id:r.id,candidates:[],error:String(e.message||e)};}
  });
}
function saveLocation(row) {
  var lat=Number(row.lat),lon=Number(row.lon);if(!validPosition_(lat,lon))throw new Error('Enter valid latitude/longitude.');
  PropertiesService.getScriptProperties().setProperty('loc_'+key_(String(row.name).slice(0,100),String(row.provider).slice(0,150),row.office||'MOB'),JSON.stringify({lat:lat,lon:lon}));return true;
}
function getBoundary(office) {
  office=office_(office||'MOB');
  var url='https://mapservices.weather.noaa.gov/static/rest/services/nws_reference_maps/nws_reference_map/MapServer/1/query?where='+encodeURIComponent("cwa='"+office+"'")+'&outFields=cwa&returnGeometry=true&outSR=4326&f=geojson';
  var r=UrlFetchApp.fetch(url,{muteHttpExceptions:true});if(r.getResponseCode()!==200)throw new Error('CWA boundary unavailable.');var data=JSON.parse(r.getContentText());if(!data.features||!data.features.length)throw new Error('No CWA boundary returned for '+office+'.');return data;
}
function searchMetadataForProduct(input,originalText) {
  var result=fetchPns(input);
  if(signature_(result.text)!==signature_(String(originalText)))throw new Error('This version now points to a different PNS issuance. Load the current product explicitly; metadata from different issuances was not combined.');
  return result;
}

function office_(office){office=String(office||'MOB').trim().toUpperCase();if(!/^[A-Z]{3}$/.test(office))throw new Error('Enter a three-letter NWS office, such as MOB, LIX or TAE.');return office;}
function officeFromUrl_(url){var m=String(url).match(/[?&]issuedby=([a-z]{3})(?:&|$)/i);return m?m[1].toUpperCase():'MOB';}
function officeUrl_(office,version){office=office_(office);return 'https://forecast.weather.gov/product.php?site='+office+'&issuedby='+office+'&product=PNS&format=txt&version='+version+'&glossary=0';}
function getPnsVersions(office){
  office=office_(office);var response=UrlFetchApp.fetch(officeUrl_(office,1),{muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw new Error('NWS office product list returned HTTP '+response.getResponseCode());
  var html=response.getContentText();if(!/<pre\b/i.test(html))throw new Error('No retained PNS product found for '+office+'.');
  var versions={1:true},match,re=/[?&](?:amp;)?version=(\d+)/gi;
  while((match=re.exec(html))){var v=Number(match[1]);if(v>=1&&v<=50)versions[v]=true;}
  return {office:office,url:officeUrl_(office,1),versions:Object.keys(versions).map(Number).sort(function(a,b){return a-b;})};
}
function inspectPns_(office,version,text){
  var m=parseMetadata_(text),issued=(text.match(/^.*(?:AM|PM)\s+\S+.*$/m)||[''])[0].trim(),headline=(text.match(/\.{3}([^\n]+?)\.{3}/)||[])[1]||'Public Information Statement';
  var item={office:office,version:version,url:officeUrl_(office,version),headline:headline,issued:issued,signature:signature_(text),count:m.records.length,detected:m.detected,codes:[],status:m.records.length?'ready':m.detected?'metadata has no supported valid records':'no metadata'};
  item.codes=Array.from(new Set(m.records.map(function(r){return r.reportCode;})));return item;
}
function scanPnsBatch(office,versions){
  office=office_(office);if(!Array.isArray(versions)||versions.length>8)throw new Error('Scan at most eight PNS versions per batch.');
  versions.forEach(function(v){if(!Number.isInteger(v)||v<1||v>50)throw new Error('Invalid PNS version.');});
  var requests=versions.map(function(v){return {url:officeUrl_(office,v),muteHttpExceptions:true};});
  var responses=UrlFetchApp.fetchAll(requests);
  return responses.map(function(response,i){var v=versions[i];try{
    if(response.getResponseCode()!==200)throw new Error('HTTP '+response.getResponseCode());
    var text=productText_(response.getContentText());
    if(!parseMetadata_(text).detected){try{var alt=readProduct_(productUrl_(officeUrl_(office,v),'CI'));if(signature_(alt)===signature_(text)&&parseMetadata_(alt).detected)text=alt;}catch(e){}}
    var item=inspectPns_(office,v,text);return item;
  }catch(e){return {office:office,version:v,url:officeUrl_(office,v),status:'unavailable',error:String(e.message||e),count:0,headline:'Unavailable'};}});
}
function productText_(html){
  var pre=String(html).match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/i);if(!pre)throw new Error('No PNS text returned.');
  return pre[1].replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"');
}
function jsonFetch_(url){var r=UrlFetchApp.fetch(url,{muteHttpExceptions:true});if(r.getResponseCode()!==200)throw new Error('GIS HTTP '+r.getResponseCode());var data=JSON.parse(r.getContentText());if(data.error)throw new Error(data.error.message||'GIS query failed');return data;}
function boundsOf_(boundary){var xmin=180,ymin=90,xmax=-180,ymax=-90;function visit(a){if(typeof a[0]==='number'){xmin=Math.min(xmin,a[0]);xmax=Math.max(xmax,a[0]);ymin=Math.min(ymin,a[1]);ymax=Math.max(ymax,a[1]);}else a.forEach(visit);}boundary.features.forEach(function(f){visit(f.geometry.coordinates);});return [xmin,ymin,xmax,ymax];}
function getCounties(office){
  office=office_(office);return jsonFetch_('https://mapservices.weather.noaa.gov/static/rest/services/nws_reference_maps/nws_reference_map/MapServer/2/query?where='+encodeURIComponent("cwa='"+office+"'")+'&outFields=countyname,state,fips&returnGeometry=true&outSR=4326&maxAllowableOffset=0.002&f=geojson');
}
function getCities(bounds){
  if(!Array.isArray(bounds)||bounds.length!==4||!bounds.every(function(n){return Number.isFinite(n);}))throw new Error('Invalid city-query bounds.');
  var cities=[],seen={};
  var rectangles=bounds[2]>180?[[Math.max(bounds[0],-180),bounds[1],180,bounds[3]],[-180,bounds[1],bounds[2]-360,bounds[3]]]:[bounds];
  rectangles=rectangles.filter(function(b){return b[0]<=b[2];});
  rectangles.forEach(function(rect){[26,28].forEach(function(layer){
    var offset=0,more=true;
    while(more){
      var url='https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/'+layer+'/query?where=1%3D1&geometry='+encodeURIComponent(rect.join(','))+'&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=GEOID,BASENAME,STATE,CENTLAT,CENTLON,POP100&returnGeometry=false&resultRecordCount=2000&resultOffset='+offset+'&f=json';
      var data=jsonFetch_(url);(data.features||[]).forEach(function(f){var a=f.attributes,lat=Number(a.CENTLAT),lon=Number(a.CENTLON),population=Number(a.POP100)||0;if(!seen[a.GEOID]&&validPosition_(lat,lon)&&population>0){seen[a.GEOID]=true;cities.push({name:a.BASENAME,lat:lat,lon:lon,population:population,major:population>=20000});}});
      more=!!data.exceededTransferLimit;offset+=2000;if(offset>20000)throw new Error('City query exceeded the safe result limit.');
    }
  });});return cities.sort(function(a,b){return b.population-a.population;});
}
