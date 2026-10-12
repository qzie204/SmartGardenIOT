/* Khung ứng dụng, điều hướng và trạng thái phiên mô phỏng. */
(function(){
  const $=SG.$,S=SG.state;
  const pages={home:'Tổng quan',data:'Dữ liệu cảm biến',history:'Lịch sử điều khiển',profile:'Hồ sơ'};
  function closeMenu(focus=false){
    const wasOpen=$('#side').classList.contains('open');$('#side').classList.remove('open');$('#scrim').classList.remove('open');$('#menu').setAttribute('aria-expanded','false');$('.workspace').inert=false;document.body.style.overflow='';$('#side').inert=window.innerWidth<=1000;
    if(focus&&wasOpen)$('#menu').focus();
  }
  function openMenu(){
    $('#side').inert=false;$('#side').classList.add('open');$('#scrim').classList.add('open');$('#menu').setAttribute('aria-expanded','true');$('.workspace').inert=true;document.body.style.overflow='hidden';$('#close-menu').focus();
  }
  SG.go=(page,focus=true)=>{
    if(!pages[page])page='home';
    SG.currentPage=page;Object.keys(pages).forEach(key=>$('#p-'+key).classList.toggle('hide',key!==page));
    document.querySelectorAll('.side nav [data-p]').forEach(button=>{if(button.dataset.p===page)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
    const title=pages[page];$('#crumb').textContent=title;$('#page-title').textContent=title;document.title=title+' · Smart Garden';
    closeMenu();
    ({home:SG.renderHome,data:SG.renderData,history:SG.renderHist,profile:SG.renderProfile})[page]();
    if(focus){$('#page-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
  };
  document.querySelectorAll('.side nav [data-p]').forEach(button=>button.onclick=()=>SG.go(button.dataset.p));
  $('#menu').onclick=openMenu;$('#close-menu').onclick=()=>closeMenu(true);$('#scrim').onclick=()=>closeMenu(true);
  $('#profile-shortcut').onclick=()=>SG.go('profile');
  document.addEventListener('keydown',event=>{
    if(!$('#side').classList.contains('open'))return;
    if(event.key==='Escape'){event.preventDefault();closeMenu(true);}
    if(event.key==='Tab'){
      const targets=[...$('#side').querySelectorAll('button:not(:disabled)')].filter(el=>el.offsetParent!==null),first=targets[0],last=targets.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  window.addEventListener('resize',()=>{if(window.innerWidth>1000||!$('#side').classList.contains('open'))closeMenu();});
  SG.start=username=>{
    S.user=username;SG.loadProfile(username);$('#auth').classList.add('hide');$('#app').classList.remove('hide');SG.updateIdentity();SG.go('home');
  };
  SG.on('complete',command=>{if(S.user)SG.toast(command.result==='success'?`${SG.act(command.action)} ${SG.DEV[command.device].name.toLowerCase()} thành công.`:command.reason,command.result==='success'?'success':'error');});
  closeMenu();
  const saved=SG.storage.get('sg_user')||SG.storage.get('sg_user','sessionStorage');
  if(saved&&SG.api.hasUser(saved))SG.start(saved);
})();
