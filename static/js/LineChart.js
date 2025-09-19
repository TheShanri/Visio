class LineChart {
  constructor(
    containerId,
    xData,
    yData,
    xLabel,
    yLabel,
    options = {}
  ) {
    if (typeof options === 'function') {
      options = { onClick: options };
    }

    this.containerId = containerId;
    this.xData = Array.isArray(xData) ? xData.map(Number) : [];
    this.yData = Array.isArray(yData) ? yData.map(Number) : [];
    this.xLabel = xLabel;
    this.yLabel = yLabel;
    this.options = Object.assign(
      {
        color: '#2563eb',
        yPadding: 0.08,
        showPoints: false,
        dotRadius: 4,
        showArea: true,
        showTooltip: true,
        enableHover: true,
        onClick: null,
        tooltipFormatter: (x, y) =>
          `${this.xLabel}: ${x.toFixed(2)}\n${this.yLabel}: ${y.toFixed(2)}`,
      },
      options || {}
    );

    if (typeof this.options.onClick !== 'function') {
      this.options.onClick = null;
    }

    this.margin = { top: 24, right: 32, bottom: 52, left: 64 };

    this.calculateDimensions();
    this.prepareData();
    this.initChart();
  }

  calculateDimensions() {
    const container = document.querySelector(this.containerId);
    const fallbackWidth = 720;
    const fallbackHeight = 360;

    let containerWidth = fallbackWidth;
    if (container) {
      const rect = container.getBoundingClientRect();
      containerWidth = rect.width || container.clientWidth || fallbackWidth;
    }

    containerWidth = Math.max(containerWidth, 420);

    this.width = containerWidth - this.margin.left - this.margin.right;
    this.height = fallbackHeight - this.margin.top - this.margin.bottom;

    if (this.width <= 0) {
      this.width = fallbackWidth - this.margin.left - this.margin.right;
    }
  }

  prepareData() {
    this.points = this.xData.reduce((acc, xValue, index) => {
      const yValue = this.yData[index];
      if (Number.isFinite(xValue) && Number.isFinite(yValue)) {
        acc.push({ x: xValue, y: yValue });
      }
      return acc;
    }, []);

    this.points.sort((a, b) => a.x - b.x);
    this.bisector = d3.bisector((d) => d.x).center;
  }

  initChart() {
    this.baseSelection = d3.select(this.containerId);
    if (this.baseSelection.empty()) {
      return;
    }

    this.baseSelection.selectAll('*').remove();

    this.svg = this.baseSelection
      .attr(
        'viewBox',
        `0 0 ${this.width + this.margin.left + this.margin.right} ${
          this.height + this.margin.top + this.margin.bottom
        }`
      )
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    if (!this.points.length) {
      this.renderEmptyState();
      return;
    }

    this.createScales();
    this.addGridlines();
    this.addAxes();
    this.drawArea();
    this.drawLine();

    if (this.options.showPoints) {
      this.drawPoints();
    }

    if (this.options.enableHover || this.options.onClick) {
      this.createTooltip();
      this.createFocusElements();
      this.addInteractionLayer();
    }
  }

  renderEmptyState() {
    this.svg
      .append('text')
      .attr('x', this.margin.left)
      .attr('y', this.margin.top)
      .attr('fill', '#94a3b8')
      .style('font-size', '1rem')
      .text('No data available');
  }

  createScales() {
    const xExtent = d3.extent(this.points, (d) => d.x);
    const yExtent = d3.extent(this.points, (d) => d.y);

    const yRange = (yExtent[1] ?? 0) - (yExtent[0] ?? 0) || 1;
    const yPadding = yRange * (this.options.yPadding ?? 0);

    this.x = d3.scaleLinear()
      .domain(xExtent)
      .nice()
      .range([0, this.width]);

    this.y = d3.scaleLinear()
      .domain([ (yExtent[0] ?? 0) - yPadding, (yExtent[1] ?? 0) + yPadding ])
      .nice()
      .range([this.height, 0]);
  }

  addGridlines() {
    this.svg
      .append('g')
      .attr('class', 'grid grid--y')
      .call(
        d3
          .axisLeft(this.y)
          .tickSize(-this.width)
          .tickFormat('')
      )
      .attr('opacity', 0.35);
  }

  addAxes() {
    const xAxis = this.svg
      .append('g')
      .attr('class', 'axis axis--x')
      .attr('transform', `translate(0,${this.height})`)
      .call(d3.axisBottom(this.x).ticks(8));

    xAxis
      .append('text')
      .attr('fill', '#64748b')
      .attr('x', this.width)
      .attr('y', 36)
      .attr('text-anchor', 'end')
      .attr('font-weight', '600')
      .text(this.xLabel);

    const yAxis = this.svg
      .append('g')
      .attr('class', 'axis axis--y')
      .call(d3.axisLeft(this.y).ticks(6));

    yAxis
      .append('text')
      .attr('fill', '#64748b')
      .attr('transform', 'rotate(-90)')
      .attr('y', -52)
      .attr('x', -this.margin.top)
      .attr('text-anchor', 'end')
      .attr('font-weight', '600')
      .text(this.yLabel);
  }

  drawArea() {
    if (!this.options.showArea) {
      return;
    }

    const gradientId = `${this.containerId.replace('#', '')}-gradient`;

    let defs = this.baseSelection.select('defs');
    if (defs.empty()) {
      defs = this.baseSelection.append('defs');
    }

    defs.select(`#${gradientId}`).remove();

    const gradient = defs
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('x2', '0%')
      .attr('y1', '0%')
      .attr('y2', '100%');

    gradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', this.options.color)
      .attr('stop-opacity', 0.35);

    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', this.options.color)
      .attr('stop-opacity', 0);

    const area = d3
      .area()
      .curve(d3.curveMonotoneX)
      .x((d) => this.x(d.x))
      .y0(this.height)
      .y1((d) => this.y(d.y));

    this.svg
      .append('path')
      .datum(this.points)
      .attr('class', 'chart-area')
      .attr('fill', `url(#${gradientId})`)
      .attr('d', area);
  }

  drawLine() {
    const line = d3
      .line()
      .curve(d3.curveMonotoneX)
      .x((d) => this.x(d.x))
      .y((d) => this.y(d.y));

    this.svg
      .append('path')
      .datum(this.points)
      .attr('class', 'chart-line')
      .attr('fill', 'none')
      .attr('stroke', this.options.color)
      .attr('stroke-width', 2.5)
      .attr('d', line);
  }

  drawPoints() {
    this.svg
      .append('g')
      .selectAll('circle')
      .data(this.points)
      .enter()
      .append('circle')
      .attr('cx', (d) => this.x(d.x))
      .attr('cy', (d) => this.y(d.y))
      .attr('r', this.options.dotRadius)
      .attr('fill', this.options.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);
  }

  createTooltip() {
    if (!this.options.showTooltip) {
      return;
    }

    const tooltipId = `${this.containerId.replace('#', '')}-tooltip`;
    d3.select(`#${tooltipId}`).remove();

    this.tooltip = d3
      .select('body')
      .append('div')
      .attr('id', tooltipId)
      .attr('class', 'chart-tooltip');
  }

  createFocusElements() {
    this.focusLine = this.svg
      .append('line')
      .attr('class', 'focus-line')
      .style('display', 'none');

    this.focusDot = this.svg
      .append('circle')
      .attr('class', 'focus-dot')
      .attr('r', this.options.dotRadius + 1)
      .style('display', 'none');
  }

  addInteractionLayer() {
    this.overlay = this.svg
      .append('rect')
      .attr('class', 'interaction-layer')
      .attr('width', this.width)
      .attr('height', this.height)
      .style('fill', 'transparent')
      .style('pointer-events', 'all')
      .on('mousemove', (event) => this.handlePointerMove(event))
      .on('mouseleave', () => this.handlePointerLeave())
      .on('click', (event) => this.handlePointerClick(event));
  }

  getPointAtX(xValue) {
    if (!this.points.length) {
      return null;
    }

    const index = Math.min(
      this.points.length - 1,
      Math.max(0, this.bisector(this.points, xValue))
    );

    return this.points[index];
  }

  handlePointerMove(event) {
    if (!this.options.enableHover) {
      return;
    }

    const [mouseX] = d3.pointer(event);
    const xValue = this.x.invert(mouseX);
    const point = this.getPointAtX(xValue);

    if (!point) {
      return;
    }

    const cx = this.x(point.x);
    const cy = this.y(point.y);

    this.focusLine
      .attr('x1', cx)
      .attr('x2', cx)
      .attr('y1', 0)
      .attr('y2', this.height)
      .style('display', 'block');

    this.focusDot
      .attr('cx', cx)
      .attr('cy', cy)
      .style('display', 'block');

    if (this.tooltip) {
      this.tooltip
        .html(this.options.tooltipFormatter(point.x, point.y).replace(/\n/g, '<br />'))
        .style('left', `${event.pageX}px`)
        .style('top', `${event.pageY - 24}px`)
        .classed('is-visible', true);
    }

    this.lastHoveredPoint = point;
  }

  handlePointerLeave() {
    if (this.focusLine) {
      this.focusLine.style('display', 'none');
    }

    if (this.focusDot) {
      this.focusDot.style('display', 'none');
    }

    if (this.tooltip) {
      this.tooltip.classed('is-visible', false);
    }
  }

  handlePointerClick(event) {
    if (!this.options.onClick) {
      return;
    }

    const [mouseX] = d3.pointer(event);
    const xValue = this.x.invert(mouseX);
    const point = this.getPointAtX(xValue) || this.lastHoveredPoint;

    if (!point) {
      return;
    }

    this.options.onClick(point);
  }
}

class InteractiveLineChart extends LineChart {
  constructor(
    containerId,
    xData,
    yData,
    xLabel,
    yLabel,
    onTrimPointsUpdate,
    options = {}
  ) {
    super(containerId, xData, yData, xLabel, yLabel, {
      enableHover: false,
      showTooltip: false,
      showArea: false,
      ...options,
    });

    this.onTrimPointsUpdate = onTrimPointsUpdate;
    this.trimPoints = [];

    if (this.points.length) {
      this.addTrimmerOverlay();
    }
  }

  addTrimmerOverlay() {
    this.overlay = this.svg
      .append('rect')
      .attr('class', 'interaction-layer')
      .attr('width', this.width)
      .attr('height', this.height)
      .style('fill', 'transparent')
      .style('pointer-events', 'all')
      .on('mousemove', (event) => this.handleHover(event))
      .on('mouseout', () => this.clearHover())
      .on('click', (event) => this.captureTrimPoint(event));
  }

  handleHover(event) {
    const [mouseX] = d3.pointer(event);
    this.clearHover();
    this.svg
      .append('line')
      .attr('class', 'hover-line')
      .attr('x1', mouseX)
      .attr('x2', mouseX)
      .attr('y1', 0)
      .attr('y2', this.height);
  }

  clearHover() {
    this.svg.selectAll('.hover-line').remove();
  }

  captureTrimPoint(event) {
    const [mouseX] = d3.pointer(event);
    const xCoord = this.x.invert(mouseX);

    this.trimPoints.push(xCoord);
    if (this.trimPoints.length > 2) {
      this.trimPoints.shift();
    }

    this.renderTrimLines();

    if (typeof this.onTrimPointsUpdate === 'function') {
      this.onTrimPointsUpdate(this.trimPoints.slice());
    }
  }

  renderTrimLines() {
    this.svg.selectAll('.trim-line').remove();

    this.trimPoints.forEach((x) => {
      const xPosition = this.x(x);
      this.svg
        .append('line')
        .attr('class', 'trim-line')
        .attr('x1', xPosition)
        .attr('x2', xPosition)
        .attr('y1', 0)
        .attr('y2', this.height);
    });
  }
}
