/* Bind the shared player to the existing wallpaper and its property listener. */
(function () {
  const settings={enabled:true,hair:1,face:1,shirt:1,wind:1,speed:1,fps:60};
  const flags={host:false,hidden:false};
  const overrides={};
  let player;
  window.applySachiMotionSettings=function (values) {
    Object.assign(settings,values);
    Object.assign(overrides,values);
    if(!player)return;
    player.setOptions(settings);
    if(settings.enabled)player.play();else player.stop();
  };
  window.suspendSachiMotion=function (reason,value) {flags[reason]=value;if(player)player.suspend(reason,value);};
  const canvas=document.getElementById('sachi-motion');
  const fallback=document.getElementById('sachi-static');
  function loadRig(){
    let project=window.SachiRigProject||SachiRig.preset(SachiAtlas);
    try{project=SachiRig.upgrade(project,SachiAtlas);}catch(error){console.warn('The bundled rig does not match the artwork; using the default loop.',error);project=SachiRig.preset(SachiAtlas);}
    try{const saved=localStorage.getItem(SachiRig.STORAGE);if(saved)project=SachiRig.upgrade(JSON.parse(saved),SachiAtlas);}catch(error){console.warn('Could not load the saved rig; using the bundled loop.',error);}
    player.setRig(project);Object.assign(settings,project.settings,overrides);player.setOptions(settings);
  }
  try {
    const padding=SachiWind.PADDING;
    player=new SachiAnimation.Player(canvas,SachiAtlas,{...settings,framing:'art',padding});
    canvas.style.inset='auto';
    canvas.style.left=(SachiAtlas.artBounds[0]-padding)+'px';
    canvas.style.top=(SachiAtlas.artBounds[1]-padding)+'px';
    canvas.style.width=canvas.width+'px';
    canvas.style.height=canvas.height+'px';
    window.sachiPlayer=player;
    for(const [reason,value] of Object.entries(flags))player.suspend(reason,value);
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateReduced=()=>player.suspend('reduced-motion',reduced.matches);
    if(reduced.addEventListener)reduced.addEventListener('change',updateReduced);
    updateReduced();
    player.loaded.then(()=>{
      canvas.hidden=false;fallback.hidden=true;
      loadRig();
      player.setOptions(settings);
      if(settings.enabled)player.play();
    }).catch(error=>{player.destroy();console.warn('Sachi motion unavailable; keeping the original image.',error);});
    window.addEventListener('storage',event=>{if(event.key===SachiRig.STORAGE&&player.ready)loadRig();});
  } catch(error) {console.warn('Sachi motion unavailable; keeping the original image.',error);}
})();
