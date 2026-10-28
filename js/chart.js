/* Biểu đồ cảm biến: chuẩn bị dữ liệu, dựng SVG và tương tác. */
(function () {
  const POINT_LIMIT = 15;
  const PADDING = {
    left: 46,
    right: 14,
    top: 14,
    bottom: 28
  };
  const NAVIGATION_KEYS = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  const HOVER_DISTANCE = 10;
  SG.CHART_POINT_LIMIT = POINT_LIMIT;

  function prepareData(readings, types) {
    const records = new Map();
    for (const reading of readings) {
      if (!types.includes(reading.type) || !Number.isFinite(reading.value) || !Number.isFinite(reading.ts) || !Number.isFinite(new Date(reading.ts).getTime())) {
        continue;
      }
      if (!records.has(reading.ts)) {
        records.set(reading.ts, {
          ts: reading.ts,
          values: {}
        });
      }
      const values = records.get(reading.ts).values;
      // Nguồn hiện tại trả bản ghi mới nhất trước; giữ bản đầu nếu trùng cảm biến/mốc đo.
      if (!(reading.type in values)) {
        values[reading.type] = reading.value;
      }
    }
    // Gom theo thời gian để các đường và tooltip luôn dùng cùng một mốc đo.
    return [...records.values()].sort((a, b) => {
      return a.ts - b.ts;
    }).slice(-POINT_LIMIT);
  }

  function createScale(values) {
    // Một nhóm cảm biến có thể chưa gửi dữ liệu; vẫn giữ trục hợp lệ.
    if (values.length === 0) {
      return { low: 0, high: 1, step: 0.2 };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    let range = max - min;
    if (range === 0) {
      range = Math.max(Math.abs(max) * 0.2, 1);
    }
    const rawStep = range / 4;
    const power = 10 ** Math.floor(Math.log10(rawStep));
    const step = [1, 2, 5, 10].find(factor => {
      return factor * power >= rawStep;
    }) * power;
    let low = Math.floor((min - range * 0.1) / step) * step;
    const high = Math.ceil((max + range * 0.1) / step) * step;
    if (min >= 0) {
      low = Math.max(0, low);
    }
    return {
      low,
      high,
      step
    };
  }

  function createAxis(records, types, unit, color) {
    const values = [];

    // Chỉ lấy giá trị của các cảm biến được gắn với trục này.
    for (const record of records) {
      for (const type of types) {
        const value = record.values[type];
        if (Number.isFinite(value)) {
          values.push(value);
        }
      }
    }

    const domain = createScale(values);
    return { domain, unit, color };
  }

  function createAxes(records, types) {
    if (types.length === 1) {
      // Tab riêng: chỉ tạo một trục bên trái cho cảm biến được chọn.
      const sensor = SG.META[types[0]];
      const leftAxis = createAxis(records, types, sensor.unit, '#6b7f71');
      return {
        left: leftAxis
      };
    }

    // Tab Tất cả: trục trái chỉ lấy dữ liệu ánh sáng; firmware hiện tại trả DO 0/1.
    const leftSensorTypes = ['light'];
    const leftAxis = createAxis(records, leftSensorTypes, SG.META.light.unit, SG.META.light.color);

    // Trục phải lấy cả nhiệt độ và độ ẩm để tính một thang đo chung.
    const rightSensorTypes = ['temperature', 'humidity'];
    const rightAxis = createAxis(records, rightSensorTypes, '°C / %', '#6b7f71');

    return {
      left: leftAxis,
      right: rightAxis
    };
  }

  function getVerticalPosition(value, domain, plot) {
    // Bước 1: tính vị trí tương đối của giá trị trong khoảng đo của trục đã chọn.
    const valueRange = domain.high - domain.low;
    const valueAboveMinimum = value - domain.low;
    const ratio = valueAboveMinimum / valueRange;

    // Bước 2: đổi tỉ lệ thành khoảng cách theo chiều cao vùng vẽ.
    const plotHeight = plot.bottom - plot.top;
    const distanceFromBottom = ratio * plotHeight;

    // Tọa độ SVG tăng từ trên xuống, nên giá trị càng lớn thì tọa độ y càng nhỏ.
    const positionY = plot.bottom - distanceFromBottom;
    return positionY;
  }

  function renderAxis(axis, side, plot, combined) {
    const { domain, unit, color } = axis;
    let axisX;
    let labelX;
    let anchor;
    let tickEnd;

    if (side === 'left') {
      // Đặt trục ở mép trái, nhãn và vạch chia nằm phía ngoài bên trái.
      axisX = plot.left;
      labelX = axisX - 8;
      anchor = 'end';
      tickEnd = axisX - 4;
    } else {
      // Đặt trục ở mép phải, nhãn và vạch chia nằm phía ngoài bên phải.
      axisX = plot.right;
      labelX = axisX + 8;
      anchor = 'start';
      tickEnd = axisX + 4;
    }
    const decimals = Math.max(0, -Math.floor(Math.log10(domain.step)));
    const tickCount = Math.round((domain.high - domain.low) / domain.step);
    let svg = `<g data-axis="${side}" data-min="${domain.low}" data-max="${domain.high}">`;

    if (combined) {
      svg += `<text x="${labelX}" y="12" text-anchor="${anchor}" font-size="10" fill="${color}">${unit}</text>`;
      svg += `<line x1="${axisX}" x2="${axisX}" y1="${plot.top}" y2="${plot.bottom}" stroke="#dce5dc"/>`;
    }

    for (let index = 0; index <= tickCount; index++) {
      const value = domain.low + index * domain.step;
      const position = getVerticalPosition(value, domain, plot);
      // Chỉ vẽ một bộ đường lưới để hai thang đo không tạo lưới chồng lên nhau.
      if (side === 'left') {
        svg += `<line x1="${plot.left}" x2="${plot.right}" y1="${position}" y2="${position}" stroke="#e9eee8" stroke-dasharray="3 4"/>`;
      }
      if (combined) {
        svg += `<line x1="${axisX}" x2="${tickEnd}" y1="${position}" y2="${position}" stroke="${color}"/>`;
      }
      svg += `<text x="${labelX}" y="${position + 3}" text-anchor="${anchor}" font-size="10" fill="${color}">${value.toFixed(decimals)}</text>`;
    }
    return svg + '</g>';
  }

  function buildChart(records, types, width, height) {
    const combined = types.length > 1;
    const axes = createAxes(records, types);
    const left = PADDING.left;
    let right;
    let top;
    if (combined) {
      // Chừa thêm chỗ cho số ở trục phải và nhãn đơn vị của hai trục.
      right = width - 52;
      top = 28;
    } else {
      right = width - PADDING.right;
      top = PADDING.top;
    }
    const bottom = height - PADDING.bottom;
    const plot = { left, right, top, bottom };
    const firstTime = records[0].ts;
    const lastTime = records.at(-1).ts;
    const x = index => {
      return firstTime === lastTime ? (left + right) / 2 : left + (records[index].ts - firstTime) / (lastTime - firstTime) * (right - left);
    };
    function y(value, type) {
      let selectedAxis;

      if (!combined) {
        // Tab một cảm biến: luôn dùng trục trái.
        selectedAxis = axes.left;
      } else if (type === 'light') {
        // Tab Tất cả, đường ánh sáng: dùng thang đo riêng bên trái.
        selectedAxis = axes.left;
      } else {
        // Tab Tất cả, đường nhiệt độ hoặc độ ẩm: dùng thang bên phải.
        selectedAxis = axes.right;
      }

      return getVerticalPosition(value, selectedAxis.domain, plot);
    }
    const labels = types.map(type => {
      return `${SG.META[type].label} (${SG.META[type].unit})`;
    }).join(', ');
    let axisDescription = '';
    if (combined) {
      axisDescription = '. Trục trái: ánh sáng (' + SG.META.light.unit + '). Trục phải: nhiệt độ (°C) và độ ẩm (%)';
    }
    let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${labels}: ${records.length} mốc đo gần nhất${axisDescription}">
      <title>${labels}</title>`;
    svg += renderAxis(axes.left, 'left', plot, combined);
    if (combined) {
      svg += renderAxis(axes.right, 'right', plot, combined);
    }
    types.forEach(type => {
      const color = SG.META[type].color;
      let path = '';
      let connected = false;
      records.forEach((record, index) => {
        const value = record.values[type];
        // Thiếu dữ liệu thì ngắt đường, không tự điền 0 hoặc nối qua khoảng trống.
        if (value === undefined) {
          connected = false;
          return;
        }
        path += `${connected ? 'L' : 'M'}${x(index).toFixed(1)},${y(value, type).toFixed(1)} `;
        connected = true;
      });
      svg += `<path data-series="${type}" d="${path}" fill="none" stroke="${color}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`;
      records.forEach((record, index) => {
        if (record.values[type] === undefined) {
          return;
        }
        svg += `<circle cx="${x(index)}" cy="${y(record.values[type], type)}" r="3" fill="${color}" stroke="#fff" stroke-width="1"/>`;
      });
    });
    const lastIndex = records.length - 1;
    const labelCount = width < 400 ? 2 : 4;
    const indices = new Set(Array.from({
      length: labelCount
    }, (_, i) => {
      return Math.round(i * lastIndex / (labelCount - 1));
    }));
    indices.forEach(index => {
      const anchor = records.length === 1 ? 'middle' : index === 0 ? 'start' : index === lastIndex ? 'end' : 'middle';
      svg += `<text x="${x(index)}" y="${height - 5}" text-anchor="${anchor}" font-size="10" fill="#6b7f71">${SG.formatTime(records[index].ts)}</text>`;
    });
    svg += `<line class="cursor-line" y1="${top}" y2="${bottom}" stroke="#6b7f71" stroke-dasharray="3 3" visibility="hidden"/></svg>`;
    return {
      svg,
      x,
      y,
      width
    };
  }

  function findHoveredReading(records, types, geometry, pointer, screenMatrix) {
    let closest = null;
    let closestDistance = HOVER_DISTANCE;

    function considerPoint(point, type, index) {
      const distance = Math.hypot(pointer.x - point.x, pointer.y - point.y);
      if (distance <= closestDistance) {
        closestDistance = distance;
        closest = { type, index };
      }
    }

    types.forEach(type => {
      let previousPoint = null;
      records.forEach((record, index) => {
        const value = record.values[type];
        if (value === undefined) {
          previousPoint = null;
          return;
        }

        // Đo khoảng cách bằng pixel màn hình để vùng rê chuột nhất quán khi đổi kích thước.
        const point = new DOMPoint(geometry.x(index), geometry.y(value, type)).matrixTransform(screenMatrix);
        considerPoint(point, type, index);

        if (previousPoint) {
          const deltaX = point.x - previousPoint.x;
          const deltaY = point.y - previousPoint.y;
          const lengthSquared = deltaX * deltaX + deltaY * deltaY;
          const projection = ((pointer.x - previousPoint.x) * deltaX + (pointer.y - previousPoint.y) * deltaY) / lengthSquared;
          const progress = Math.max(0, Math.min(1, projection));
          const nearestPoint = {
            x: previousPoint.x + progress * deltaX,
            y: previousPoint.y + progress * deltaY
          };
          // Rê giữa hai điểm vẫn chọn đúng đường, nhưng tooltip luôn hiển thị một lần đo thật.
          const nearestIndex = progress <= 0.5 ? index - 1 : index;
          considerPoint(nearestPoint, type, nearestIndex);
        }
        previousPoint = point;
      });
    });
    return closest;
  }

  function renderStats(records, type) {
    const values = records.map(record => {
      return record.values[type];
    }).filter(value => {
      return value !== undefined;
    });
    const meta = SG.META[type];
    const total = values.reduce((sum, value) => {
      return sum + value;
    }, 0);
    const stats = [
      ['Thấp nhất', Math.min(...values)],
      ['Trung bình', total / values.length],
      ['Cao nhất', Math.max(...values)]
    ];
    const statisticItems = stats.map(([label, value]) => {
      return `<div><span>${label}</span><b>${value.toFixed(meta.decimals)} ${meta.unit}</b></div>`;
    }).join('');
    return `<div class="chart-stats">${statisticItems}</div>`;
  }

  function bindInteraction(element, records, types, geometry, previousTime, previousSensor) {
    const box = element.querySelector('.chart-box');
    const tip = box.querySelector('.tip');
    const line = box.querySelector('.cursor-line');
    const output = element.querySelector('.chart-keyboard');
    const previousIndex = records.findIndex(record => {
      return record.ts === previousTime;
    });
    let index = previousIndex >= 0 ? previousIndex : records.length - 1;
    let selectedSensor = types.includes(previousSensor) ? previousSensor : types[0];

    function show(nextIndex, announce = false) {
      index = Math.max(0, Math.min(records.length - 1, nextIndex));
      const record = records[index];
      box.dataset.timestamp = record.ts;
      box.dataset.selectedSensor = selectedSensor;
      const value = record.values[selectedSensor];
      const formattedValue = value === undefined
        ? 'Chưa có dữ liệu'
        : SG.formatReading({ type: selectedSensor, value });
      const description = `${SG.META[selectedSensor].label}: ${formattedValue}`;
      tip.innerHTML = `<time>${SG.formatDateTime(record.ts)}</time><div>${SG.escapeHtml(description)}</div>`;
      tip.hidden = false;
      const halfTip = tip.offsetWidth / 2;
      const position = geometry.x(index) / geometry.width * box.clientWidth;
      tip.style.left = Math.max(halfTip, Math.min(box.clientWidth - halfTip, position)) + 'px';
      line.setAttribute('x1', geometry.x(index));
      line.setAttribute('x2', geometry.x(index));
      line.setAttribute('stroke', SG.META[selectedSensor].color);
      line.setAttribute('visibility', 'visible');
      if (announce) {
        output.textContent = `${SG.formatDateTime(record.ts)}. ${description}`;
      }
    }

    function hide() {
      tip.hidden = true;
      line.setAttribute('visibility', 'hidden');
    }

    box.onpointermove = event => {
      if (types.length > 1) {
        const screenMatrix = box.querySelector('svg').getScreenCTM();
        if (!screenMatrix) {
          hide();
          return;
        }
        const pointer = { x: event.clientX, y: event.clientY };
        const hovered = findHoveredReading(records, types, geometry, pointer, screenMatrix);
        if (!hovered) {
          hide();
          return;
        }
        selectedSensor = hovered.type;
        show(hovered.index);
        return;
      }

      const bounds = box.getBoundingClientRect();
      const position = (event.clientX - bounds.left) / bounds.width * geometry.width;
      const nearest = records.reduce((best, _, i) => {
        return Math.abs(geometry.x(i) - position) < Math.abs(geometry.x(best) - position) ? i : best;
      }, 0);
      show(nearest);
    };
    box.onpointerleave = hide;
    box.onblur = hide;

    box.onfocus = () => {
      return show(index, true);
    };

    box.onkeydown = event => {
      if (types.length > 1 && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const nextSensorIndex = (types.indexOf(selectedSensor) + direction + types.length) % types.length;
        selectedSensor = types[nextSensorIndex];
        show(index, true);
        return;
      }
      if (!NAVIGATION_KEYS.includes(event.key)) {
        return;
      }
      event.preventDefault();
      let nextIndex;
      if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = records.length - 1;
      } else {
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        nextIndex = index + direction;
      }
      show(nextIndex, true);
    };
    if (previousTime !== null) {
      box.focus({
        preventScroll: true
      });
    }
  }

  SG.chart = (element, mode = 'all') => {
    if (!element || element.closest('#p-home')?.classList.contains('hide')) {
      return;
    }
    const state = SG.state;
    let types;

    if (mode === 'all') {
      // Chọn Tất cả: lấy đủ nhiệt độ, độ ẩm và ánh sáng để vẽ ba đường.
      types = SG.TYPES;
    } else if (SG.TYPES.includes(mode)) {
      // Chọn một cảm biến: danh sách chỉ chứa cảm biến đó để vẽ một đường.
      types = [mode];
    } else {
      // Nếu nhận lựa chọn không hợp lệ, quay về biểu đồ Tất cả.
      types = SG.TYPES;
    }

    const records = prepareData(state.readings, types);
    const activeBox = element.querySelector('.chart-box');
    const previousTime = activeBox && document.activeElement === activeBox ? Number(activeBox.dataset.timestamp) : null;
    const previousSensor = activeBox?.dataset.selectedSensor;
    if (!state.ready || !records.length) {
      const title = state.ready ? 'Chưa có dữ liệu' : 'Đang tải dữ liệu…';
      const hint = state.ready
        ? 'Dữ liệu mới sẽ xuất hiện tại đây.'
        : 'Chờ một chút để chuẩn bị khu vườn.';
      element.innerHTML = `<div class="chart-empty">${SG.empty(title, hint)}</div>`;
      return;
    }
    const combined = types.length > 1;
    const keyboardHint = combined
      ? 'Dùng phím lên hoặc xuống để chọn cảm biến, trái hoặc phải để đọc từng mốc đo.'
      : 'Dùng phím mũi tên trái hoặc phải để đọc từng mốc đo.';
    const legend = types.map(type => {
      return [
        `<span class="chart-legend-item" style="--chart-color:${SG.META[type].color}">
      <i class="chart-line-key" aria-hidden="true">`,
        `</i>${SG.META[type].label} (${SG.META[type].unit})</span>`
      ].join('');
    }).join('');
    element.innerHTML = [
      `<div class="single-chart">
      <div class="chart-summary">`,
      `<span>${state.online ? 'Mỗi 2 giây' : 'Đã dừng cập nhật'}</span>`,
      `<span>${records.length} mốc đo</span>`,
      `</div>
      <div class="chart-legend">${legend}</div>
      <div class="chart-box" tabindex="0" role="group" data-chart-type="${combined ? 'all' : types[0]}"
        aria-label="Biểu đồ ${combined ? 'tất cả cảm biến' : SG.META[types[0]].label}. ${keyboardHint}">`,
      `</div>
      ${combined ? '<p class="chart-note">Trái: ánh sáng (' + SG.META.light.unit + '). Phải: nhiệt độ (°C), độ ẩm (%).</p>' : renderStats(records, types[0])}
      <p class="chart-keyboard sr" aria-live="polite" aria-atomic="true">`,
      `</p>
    </div>`
    ].join('');
    const box = element.querySelector('.chart-box');
    const geometry = buildChart(records, types, Math.max(240, box.clientWidth || 500), Math.max(130, box.clientHeight || 205));
    box.innerHTML = `${geometry.svg}<div class="tip" hidden></div>`;
    bindInteraction(element, records, types, geometry, previousTime, previousSensor);
  };
})();
