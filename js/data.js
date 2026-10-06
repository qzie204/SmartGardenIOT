(function(){
  const $=SG.$,D={by:'all',q:'',asc:false,page:1,size:10};
  const hints={all:'Nhập tên cảm biến, thời gian hoặc cả hai…',sensor:'Chỉ tìm tên cảm biến, ví dụ nhiệt độ',time:'Chỉ tìm thời gian, ví dụ 06/10/26 hoặc 14:32'};
  function filtered(){
    const q=D.q.trim();
    const rows=SG.state.readings.filter(r=>{
      if(!q)return true;
      const sensorMatches=text=>SG.norm(SG.META[r.type].l+' '+r.type).includes(SG.norm(text));
      const timeMatches=text=>/^[\d\s/.:,-]+$/.test(text)&&SG.matchTime(text,r.ts);
      if(D.by==='sensor')return sensorMatches(q);
      if(D.by==='time')return timeMatches(q);
      if(sensorMatches(q)||timeMatches(q))return true;
      // Trong "Tất cả", cho phép ghép tên cảm biến với ngày/giờ trong cùng ô.
      const sensorText=q.replace(/[\d\s/.:,-]+/g,' ').trim();
      const timeText=(q.match(/\d[\d/.:,-]*/g)||[]).join(' ');
      return !!sensorText&&!!timeText&&sensorMatches(sensorText)&&timeMatches(timeText);
    });
    return D.asc?rows.reverse():rows;
  }
  function render(){
    const rows=filtered();
    $('#d-q').placeholder=hints[D.by];$('#d-time-head').setAttribute('aria-sort',D.asc?'ascending':'descending');
    $('#d-sort').innerHTML='Thời gian ghi nhận '+SG.ic(D.asc?'ph-arrow-up':'ph-arrow-down');
    $('#data-count').textContent=SG.state.ready?`${rows.length} bản ghi · Cập nhật tự động mỗi 5 giây`:'Đang chuẩn bị dữ liệu…';
    SG.pager('#d-pg',D,SG.state.ready?rows.length:0,render);
    $('#d-body').innerHTML=!SG.state.ready?`<tr><td colspan="4" class="none">${SG.empty('Đang tải dữ liệu…','Các bản ghi sẽ xuất hiện trong giây lát.')}</td></tr>`:!rows.length?`<tr><td colspan="4" class="none">${SG.empty()}</td></tr>`:rows.slice((D.page-1)*D.size,D.page*D.size).map(r=>`<tr><td class="record-id">#${String(r.id).padStart(4,'0')}</td><td><span class="sensor-label" data-sensor="${r.type}"><span class="sensor-icon">${SG.ic(SG.META[r.type].icon)}</span>${SG.META[r.type].l}</span></td><td class="num">${SG.val(r)}</td><td><time datetime="${new Date(r.ts).toISOString()}">${SG.fmt(r.ts)}</time></td></tr>`).join('');
  }
  $('#d-by').onchange=e=>{D.by=e.target.value;D.page=1;render();};
  $('#d-q').oninput=e=>{D.q=e.target.value;D.page=1;render();};
  $('#d-cl').onclick=()=>{Object.assign(D,{by:'all',q:'',asc:false,page:1});$('#d-by').value='all';$('#d-q').value='';render();};
  $('#d-sort').onclick=()=>{D.asc=!D.asc;D.page=1;render();};
  SG.renderData=render;SG.on('data',()=>{if(SG.state.user&&SG.currentPage==='data')render();});
})();
