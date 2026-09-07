(function(){
  'use strict';
  const $=id=>document.getElementById(id),Rig=SachiRig,atlas=SachiAtlas;
  const DRAFT=Rig.STORAGE+'-draft',history=[],future=[],pendingBase=new Map();
  let project=Rig.preset(atlas),selected='hair-side-left',parameter='bend',filter='all',editing=false,showOriginal=false;
  const status=message=>{$('status').textContent=message;};
  let loadWarning='';
  try{const saved=localStorage.getItem(DRAFT);if(saved)project=Rig.upgrade(JSON.parse(saved),atlas);}catch(error){loadWarning='Saved draft could not be read; showing the default rig.';}
  const player=new SachiAnimation.Player($('rig-canvas'),atlas);
  window.sachiRigEditor={player,get project(){return project;}};
  const part=()=>project.parts[selected];
  const spec=()=>Rig.PARAMETERS[parameter];
  const isEye=id=>id==='eye-left'||id==='eye-right';
  const category=id=>{const pass=player.categories.get(id);return pass==='body'?'shirt':pass?.includes('hair')?'hair':'face';};
  const format=value=>Number(value.toFixed(2)).toString();
  function remember(){const snapshot=JSON.stringify(project);if(history.at(-1)!==snapshot){history.push(snapshot);if(history.length>60)history.shift();}future.length=0;buttons();}
  function buttons(){$('undo').disabled=!history.length;$('redo').disabled=!future.length;}
  function persist(){try{localStorage.setItem(DRAFT,JSON.stringify(project));}catch(error){status('Draft storage is unavailable. Save the rig to keep your changes.');}}
  function refresh(){
    showOriginal=false;$('rest').textContent='Compare original';
    player.rigView.selected=selected;player.rigView.solo=$('solo').checked?selected:null;
    player.atRest=false;player.settings=SachiAnimation.options(project.settings,player.settings);player.setRig(project);persist();buttons();drawCurve();
  }
  function renderLayers(){
    const query=$('search').value.toLowerCase(),list=$('layers');list.replaceChildren();
    for(const node of atlas.nodes){
      if(node.kind!=='art'||(filter!=='all'&&category(node.id)!==filter)||!Rig.label(node.id).toLowerCase().includes(query))continue;
      const button=document.createElement('button');button.className='layer'+(!node.frame?' group':'')+(project.parts[node.id].visible?'':' hidden-layer');
      button.dataset.id=node.id;button.setAttribute('aria-pressed',String(selected===node.id));
      let depth=0;for(let p=node.parent;p;p=player.nodes.get(p)?.parent)depth++;
      button.style.paddingLeft=(6+Math.min(3,depth)*6)+'px';
      const icon=document.createElement('span');icon.className='layer-icon';icon.textContent=!node.frame?'▱':category(node.id)==='hair'?'H':category(node.id)==='shirt'?'C':'F';
      const label=document.createElement('span');label.textContent=Rig.label(node.id);button.append(icon,label);
      if(Object.values(project.parts[node.id].tracks).some(keys=>keys.length)){const dot=document.createElement('span');dot.className='key-dot';dot.textContent='◆';button.append(dot);}
      button.addEventListener('click',()=>select(node.id));list.append(button);
    }
  }
  function select(id){selected=id;const available=['x','y','r'];if(['hair','shirt'].includes(category(id))&&player.nodes.get(id).frame)available.push('bend','wind','lag');if(isEye(id))available.push('close');
    if(!available.includes(parameter))parameter=available.includes('bend')?'bend':available.includes('close')?'close':'r';
    $('parameter').replaceChildren(...available.map(key=>{const option=document.createElement('option');option.value=key;option.textContent=Rig.PARAMETERS[key].label;return option;}));$('parameter').value=parameter;
    $('selected-name').textContent=Rig.label(id);$('parent-label').textContent='Parent · '+Rig.label(player.nodes.get(id).parent||'model');
    $('visible').checked=part().visible;$('pivot-x').value=part().pivot[0];$('pivot-y').value=part().pivot[1];
    player.rigView.selected=id;player.rigView.solo=$('solo').checked?id:null;
    if(player.ready&&!player.playing)player.seek(player.time);
    renderLayers();inspector();
  }
  function inspector(){
    const p=spec();$('value-label').textContent=p.label;
    for(const id of ['value','number']){const el=$(id);el.min=p.min;el.max=p.max;el.step=p.step;el.value=format(Rig.pose(part(),player.time)[parameter]);}
    $('value-output').textContent=format(Rig.pose(part(),player.time)[parameter])+p.unit;
    $('keys').replaceChildren();
    for(const key of part().tracks[parameter]||[]){
      const row=document.createElement('span');row.className='key';
      const go=document.createElement('button');go.textContent=key.time.toFixed(2)+' s';go.title='Seek to '+key.time+' s · '+format(key.value)+p.unit;
      go.addEventListener('click',()=>{player.pause().seek(key.time);transport();inspector();});
      const remove=document.createElement('button');remove.textContent='×';remove.className='remove-key';remove.setAttribute('aria-label','Delete key at '+key.time+' seconds');
      remove.addEventListener('click',()=>{remember();part().tracks[parameter]=part().tracks[parameter].filter(k=>k!==key);refresh();inspector();renderLayers();});row.append(go,remove);$('keys').append(row);
    }
    $('clear-track').disabled=!(part().tracks[parameter]?.length);drawCurve();
  }
  function drawCurve(){
    const p=spec(),keys=part().tracks[parameter]||[],base=part().values[parameter]??p.value;
    const values=keys.length?keys.map(key=>key.value):[base],low=Math.min(...values),high=Math.max(...values),margin=Math.max((high-low)*.3,(p.max-p.min)*.03),min=low-margin,max=high+margin;
    const y=value=>72-(value-min)/(max-min)*60;
    const points=Array.from({length:201},(_,i)=>`${i*4},${y(Rig.trackAt(keys,i/10,base,part().interpolation)).toFixed(2)}`).join(' ');
    let markup='<path d="M0 72H800 M0 42H800 M0 12H800 M200 0V84 M400 0V84 M600 0V84" stroke="#2b3b45" stroke-width="1" fill="none"/>';
    markup+=`<polyline points="${points}" fill="none" stroke="#aedbd0" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
    for(const key of keys)markup+=`<circle cx="${key.time*40}" cy="${y(key.value)}" r="3.5" fill="#d4eabf"/>`;
    markup+=`<path id="playhead" d="M${player.time*40} 0V84" stroke="#f0d7a2" stroke-width="1"/>`;
    $('curve').innerHTML=markup;$('track-label').textContent=Rig.label(selected)+' · '+p.label;
  }
  function transport(){$('play').textContent=player.playing?'Pause':'Play';}
  function beginEdit(){if(!editing){remember();editing=true;}player.pause();transport();}
  function changeValue(raw){
    const value=Math.max(spec().min,Math.min(spec().max,Number(raw)));if(!Number.isFinite(value))return;
    beginEdit();
    if(part().tracks[parameter]?.length)Rig.keyframe(part(),parameter,player.time,value);else{const key=selected+'/'+parameter;if(!pendingBase.has(key))pendingBase.set(key,part().values[parameter]??spec().value);part().values[parameter]=value;}
    $('value').value=value;$('number').value=value;$('value-output').textContent=format(value)+spec().unit;refresh();
  }
  for(const id of ['value','number']){$(id).addEventListener('input',()=>changeValue($(id).value));$(id).addEventListener('change',()=>{editing=false;inspector();renderLayers();});}
  $('add-key').addEventListener('click',()=>{remember();player.pause();transport();const value=Number($('number').value);
    if(!part().tracks[parameter]?.length&&player.time>.005)Rig.keyframe(part(),parameter,0,pendingBase.get(selected+'/'+parameter)??part().values[parameter]??spec().value);
    pendingBase.delete(selected+'/'+parameter);
    Rig.keyframe(part(),parameter,player.time,value);refresh();inspector();renderLayers();status('Key saved · '+Rig.label(selected)+' / '+spec().label+' at '+player.time.toFixed(2)+' s.');});
  $('clear-track').addEventListener('click',()=>{remember();part().values[parameter]=Rig.pose(part(),player.time)[parameter];delete part().tracks[parameter];refresh();inspector();renderLayers();});
  $('parameter').addEventListener('change',()=>{parameter=$('parameter').value;inspector();});
  $('visible').addEventListener('change',()=>{remember();part().visible=$('visible').checked;refresh();renderLayers();});
  $('solo').addEventListener('change',()=>{player.rigView.solo=$('solo').checked?selected:null;player.seek(player.time);status($('solo').checked?'Solo view · '+Rig.label(selected):'Whole model visible.');});
  for(const [axis,index] of [['x',0],['y',1]])$('pivot-'+axis).addEventListener('change',()=>{const n=Number($('pivot-'+axis).value);if(!Number.isFinite(n))return;remember();part().pivot[index]=Math.max(0,Math.min(index?970:708,n));refresh();select(selected);});
  $('reset-layer').addEventListener('click',()=>{remember();project.parts[selected]=Rig.create(atlas).parts[selected];refresh();select(selected);status('Layer reset. Undo restores its previous motion.');});
  $('search').addEventListener('input',renderLayers);
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));renderLayers();}));
  $('timeline').addEventListener('input',()=>{player.pause().seek(Number($('timeline').value));showOriginal=false;$('rest').textContent='Compare original';transport();inspector();});
  $('curve').addEventListener('click',event=>{const rect=$('curve').getBoundingClientRect();player.pause().seek((event.clientX-rect.left)/rect.width*20);transport();inspector();});
  $('speed').addEventListener('change',()=>player.setOptions({speed:Number($('speed').value)}));
  $('play').addEventListener('click',()=>{if(player.playing)player.pause();else{showOriginal=false;$('rest').textContent='Compare original';player.play();}transport();});
  $('replay').addEventListener('click',()=>{showOriginal=false;$('rest').textContent='Compare original';$('solo').checked=false;player.rigView.solo=null;player.seek(.4).play();transport();});
  $('rest').addEventListener('click',()=>{player.pause();showOriginal=!showOriginal;if(showOriginal){player.render(true);$('overlay').replaceChildren();}else player.seek(player.time);$('rest').textContent=showOriginal?'Return to rig':'Compare original';transport();});
  $('background').addEventListener('change',()=>$('scene').classList.toggle('background',$('background').checked));
  $('mesh').addEventListener('change',()=>{player.rigView.mesh=$('mesh').checked;if(!player.playing)player.render(showOriginal);});
  $('wind').addEventListener('input',()=>{beginEdit();project.settings.wind=Number($('wind').value)/100;$('wind-output').textContent=$('wind').value+'%';refresh();});
  $('wind').addEventListener('change',()=>{editing=false;});
  function restore(stack,opposite){if(!stack.length)return;pendingBase.clear();opposite.push(JSON.stringify(project));project=Rig.validate(JSON.parse(stack.pop()),atlas);refresh();select(selected);$('wind').value=project.settings.wind*100;$('wind-output').textContent=format(project.settings.wind*100)+'%';}
  $('undo').addEventListener('click',()=>restore(history,future));$('redo').addEventListener('click',()=>restore(future,history));
  function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('save').addEventListener('click',()=>{download('sachi-rig-project.json',JSON.stringify(project,null,2)+'\n','application/json');status('Saved a reusable rig with all layer poses and keyframes.');});
  $('export').addEventListener('click',()=>{download('project.js','/* Exported from Sachi layer rig editor. */\nwindow.SachiRigProject = '+JSON.stringify(project)+';\n','text/javascript');status('Exported project.js · replace images/sachi-rig/project.js to use this rig in Wallpaper Engine.');});
  $('apply').addEventListener('click',()=>{try{localStorage.setItem(Rig.STORAGE,JSON.stringify(project));status('Applied to the wallpaper on this browser origin. Open the wallpaper to review it.');}catch(error){status('Browser storage is unavailable. Export the wallpaper rig instead.');}});
  $('load').addEventListener('click',()=>$('file').click());
  $('file').addEventListener('change',async()=>{const file=$('file').files[0];if(!file)return;
    try{if(file.size>1000000)throw new Error('The rig file is too large.');const next=Rig.validate(JSON.parse(await file.text()),atlas);remember();project=next;refresh();select(selected);$('wind').value=project.settings.wind*100;$('wind-output').textContent=format(project.settings.wind*100)+'%';status('Loaded '+project.name+'.');}catch(error){status('Could not load rig: '+error.message);}finally{$('file').value='';}});
  let lastOverlay=0;
  player.onframe=state=>{
    $('time').textContent=state.time.toFixed(2).padStart(5,'0')+' / 20.00';$('timeline').value=state.time;
    $('playhead')?.setAttribute('d','M'+state.time*40+' 0V84');
    const now=performance.now();if(now-lastOverlay<45)return;lastOverlay=now;
    if(!editing){const value=Rig.pose(part(),state.time)[parameter];$('value-output').textContent=format(value)+spec().unit;for(const id of ['value','number'])if(document.activeElement!==$(id))$(id).value=format(value);}
    if(!$('mesh').checked||showOriginal||!player.rigMesh){$('overlay').replaceChildren();return;}
    const {positions,triangles}=player.rigMesh;let path='';
    for(let i=0;i<triangles.length;i+=3){const points=triangles.slice(i,i+3).map(id=>positions[id]);path+=`M${points.map(p=>p.map(v=>v.toFixed(1)).join(',')).join('L')}Z`;}
    $('overlay').innerHTML=`<path d="${path}" stroke="#d2fbd6" stroke-opacity=".65" stroke-width=".8" fill="#a1eeb6" fill-opacity=".035"/>`;
  };
  $('part-count').textContent=atlas.nodes.filter(node=>node.kind==='art'&&node.frame).length+' paint layers';
  select(selected);$('wind').value=project.settings.wind*100;$('wind-output').textContent=format(project.settings.wind*100)+'%';
  player.loaded.then(()=>{refresh();$('play').disabled=false;if(!matchMedia('(prefers-reduced-motion: reduce)').matches)player.play();transport();status(loadWarning||'Ready · select a layer to refine the loop. Draft changes save in this browser.');}).catch(error=>status('Unable to load the model: '+error.message));
})();
