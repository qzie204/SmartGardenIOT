(function () {
  const $=SG.$,S=SG.state;
  let mode='temperature';
  const shortLabels={temperature:'Nhiệt độ',humidity:'Độ ẩm',light:'Ánh sáng'};
  function chartFrame() {
    if($('#c-body'))return;
    $('#chart').innerHTML=`<div class="section-head chart-head"><h2>Biểu đồ</h2><span class="subtle-chip">12 lần đo gần nhất</span></div><div class="chart-tabs" role="tablist" aria-label="Chọn biểu đồ">${SG.TYPES.map(type=>`<button id="tab-${type}" type="button" role="tab" data-mode="${type}" aria-controls="c-body" aria-selected="${type===mode}" tabindex="${type===mode?'0':'-1'}">${shortLabels[type]}</button>`).join('')}</div><div id="c-body" role="tabpanel" aria-labelledby="tab-temperature"></div>`; //tạo 3 nút
    const tabs=[...document.querySelectorAll('[data-mode]')];
    function choose(type){mode=type;tabs.forEach(b=>{const active=b.dataset.mode===mode;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});$('#c-body').setAttribute('aria-labelledby','tab-'+mode);SG.chart($('#c-body'),mode);} //thay đổi loại biểu đồ
    tabs.forEach((button,i)=>{button.onclick=()=>choose(button.dataset.mode);button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[index].focus();choose(tabs[index].dataset.mode);};}); //phím di chuyển trên biểu đồ
  } //biểu đồ
  function renderMetrics(){
    $('#metrics').innerHTML=SG.TYPES.map(type=>{
      const meta=SG.META[type],reading=S.readings.find(p=>p.type===type);
      return `<article class="metric" data-t="${type}"><div class="metric-top"><p class="metric-l">${meta.l}</p><span class="metric-ic">${SG.ic(meta.icon)}</span></div><div class="metric-main"><p class="metric-v">${S.ready&&reading?`${reading.value.toFixed(meta.d)}<small>${meta.u}</small>`:'—'}</p></div></article>`;
    }).join('');
    chartFrame();SG.chart($('#c-body'),mode);
  } //3 thẻ 
  function renderCtrl(){
    if(!$('#device-list')){
      $('#ctrl').innerHTML=`<div class="section-head"><h2>Thiết bị</h2></div><p class="offline-note" id="offline-note" hidden>${SG.ic('ph-wifi-slash')} Mất kết nối. Chưa thể gửi lệnh.</p><div id="device-list">${Object.entries(SG.DEV).map(([key,meta])=>`<div class="dev" data-device="${key}"><div class="dev-row"><span class="dev-ic">${SG.ic(meta.icon)}</span><div class="dev-t"><b>${meta.name}</b><span class="dev-s" aria-live="polite"></span></div><button class="switch" role="switch" data-d="${key}" aria-label="${meta.name}" aria-checked="false"></button></div></div>`).join('')}</div><div class="ctrl-foot" id="ctrl-foot"></div>`;
      $('#device-list').querySelectorAll('.switch').forEach(b=>b.onclick=()=>SG.api.send(b.dataset.d)); //Gửi lệnh bắt/tắt để update qua history
    } //Bật/Tắt thiết bị
    $('#offline-note').hidden=S.online;
    Object.entries(S.dev).forEach(([key,value])=>{
      const item=$(`[data-device="${key}"]`),button=item.querySelector('.switch');
      item.classList.toggle('on',value.on);button.setAttribute('aria-checked',String(value.on));button.disabled=value.pending||!S.online;
      button.setAttribute('aria-label',`${SG.DEV[key].name}: ${value.on?'đang bật, bấm để tắt':'đang tắt, bấm để bật'}`);
      item.querySelector('.dev-s').innerHTML=value.pending?SG.ic('ph-spinner spin')+' Đang chờ xác nhận':!S.online?SG.ic('ph-wifi-slash')+' Mất kết nối':`<span class="status-dot"></span>${value.on?'Đang bật':'Đang tắt'}`;
    });
    const last=S.commands[0];
    $('#ctrl-foot').innerHTML=`<div class="kv"><span>Lệnh gần nhất</span><b>${last?SG.act(last.action)+' '+SG.DEV[last.device].name.toLowerCase():'Chưa có lệnh'}</b></div><div class="kv"><span>Phản hồi</span>${last?SG.badge(last.result):'—'}</div><div class="kv"><span>Thời gian gửi</span><time>${last?SG.fmtT(last.sentAt):'—'}</time></div>${last&&['failed','timeout'].includes(last.result)?`<p class="err">${SG.esc(last.reason)} Bạn có thể gửi lại lệnh.</p>`:''}`;
  }
  SG.renderHome=()=>{renderMetrics();renderCtrl();};
  SG.redrawChart=()=>{chartFrame();SG.chart($('#c-body'),mode);};
  SG.on('data',()=>{if(S.user)renderMetrics();});
  SG.on('cmd',()=>{if(S.user){renderCtrl();}});
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(S.user)SG.redrawChart();},80);});
})();
