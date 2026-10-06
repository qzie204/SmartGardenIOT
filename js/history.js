(function(){
  const $=SG.$,H={q:'',dev:'',act:'',res:'',asc:false,page:1,size:10};
  SG.showCommand=id=>{
    const c=SG.state.commands.find(c=>c.id===id);if(!c)return;
    SG.dialog('Chi tiết lệnh #'+String(c.id).padStart(3,'0'),`<p>${SG.act(c.action)} ${SG.DEV[c.device].name.toLowerCase()}</p><dl><div><dt>Trạng thái</dt><dd>${SG.badge(c.result)}</dd></div><div><dt>Người thao tác</dt><dd>${SG.esc(c.user)}</dd></div><div><dt>Thời gian gửi</dt><dd>${SG.fmt(c.sentAt)}</dd></div><div><dt>Phản hồi</dt><dd>${c.respondedAt?SG.fmt(c.respondedAt):c.result==='pending'?'Đang chờ':'Không có phản hồi'}</dd></div></dl>${c.reason?`<p class="notice">${SG.esc(c.reason)} Trạng thái thiết bị không thay đổi. Bạn có thể gửi lại lệnh tại Tổng quan.</p>`:''}<div class="dialog-actions"><button class="btn primary" type="button" data-close>Đóng</button></div>`);
    $('#dlg').dataset.commandId=String(id);
  };
  $('#dlg').addEventListener('close',()=>{delete $('#dlg').dataset.commandId;});
  function render(){
    const commands=SG.state.commands;
    const rows=commands.filter(c=>(!H.dev||c.device===H.dev)&&(!H.act||c.action===H.act)&&(!H.res||c.result===H.res)&&(!H.q.trim()||SG.matchTime(H.q,c.sentAt)));
    if(H.asc)rows.reverse();
    SG.pager('#h-pg',H,rows.length,render);
    $('#h-body').innerHTML=rows.length?rows.slice((H.page-1)*H.size,H.page*H.size).map(c=>`<tr><td class="record-id">#${String(c.id).padStart(3,'0')}</td><td><span class="sensor-label">${SG.ic(SG.DEV[c.device].icon)}${SG.DEV[c.device].name}</span></td><td>${SG.act(c.action)}</td><td>${SG.esc(c.user)}</td><td>${SG.badge(c.result)}</td><td><time datetime="${new Date(c.sentAt).toISOString()}">${SG.fmt(c.sentAt)}</time></td><td><button class="text-btn" data-id="${c.id}" aria-label="Chi tiết lệnh ${c.id}">Chi tiết ${SG.ic('ph-arrow-up-right')}</button></td></tr>`).join(''):`<tr><td colspan="7" class="none">${SG.empty()}</td></tr>`;
    $('#h-body').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>SG.showCommand(+b.dataset.id));
  }
  $('#h-q').oninput=e=>{H.q=e.target.value;H.page=1;render();};
  [['#h-dev','dev'],['#h-act','act'],['#h-res','res']].forEach(([selector,key])=>{$(selector).onchange=e=>{H[key]=e.target.value;H.page=1;render();};});
  $('#h-ord').onchange=e=>{H.asc=e.target.value==='old';H.page=1;render();};
  $('#h-cl').onclick=()=>{Object.assign(H,{q:'',dev:'',act:'',res:'',asc:false,page:1});['#h-q','#h-dev','#h-act','#h-res'].forEach(s=>$(s).value='');$('#h-ord').value='new';render();};
  SG.renderHist=render;SG.on('cmd',()=>{if(SG.state.user){render();if($('#dlg').open&&$('#dlg').dataset.commandId)SG.showCommand(+$('#dlg').dataset.commandId);}});
})();
