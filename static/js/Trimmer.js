class Trimmer {
  constructor(
    data,
    chartSelector,
    interactiveChartSelector,
    onChange,
    options = {}
  ) {
    this.originalData = Array.isArray(data)
      ? data.map((point) => ({ ...point }))
      : [];
    this.trimmedData = this.originalData.slice();
    this.chartSelector = chartSelector;
    this.interactiveChartSelector = interactiveChartSelector;
    this.onChange = onChange;
    this.trimIntervals = [];
    this.currentTrimPoints = null;
    this.lineChartOptions = options.lineChartOptions || {};
    this.interactiveOptions = options.interactiveOptions || {};

    this.renderPrimaryChart();
    this.initializeInteractiveChart();
    this.notifyChange({
      message: this.originalData.length
        ? 'Select two points on the interactive chart to trim that range.'
        : 'No bladder pressure data available to trim.',
      messageType: this.originalData.length ? 'info' : 'warning',
    });
  }

  renderPrimaryChart() {
    const selection = d3.select(this.chartSelector);
    if (selection.empty()) {
      return;
    }

    selection.selectAll('*').remove();

    const elapsed = this.trimmedData.map((d) => d['Elapsed Time']);
    const pressure = this.trimmedData.map((d) => d['Bladder Pressure']);

    this.primaryChart = new LineChart(
      this.chartSelector,
      elapsed,
      pressure,
      'Elapsed Time (s)',
      'Bladder Pressure (cmH₂O)',
      Object.assign({ color: '#7c3aed' }, this.lineChartOptions)
    );
  }

  initializeInteractiveChart() {
    const selection = d3.select(this.interactiveChartSelector);
    if (selection.empty()) {
      return;
    }

    selection.selectAll('*').remove();

    this.interactiveChart = new InteractiveLineChart(
      this.interactiveChartSelector,
      this.trimmedData.map((d) => d['Elapsed Time']),
      this.trimmedData.map((d) => d['Bladder Pressure']),
      'Elapsed Time (s)',
      'Bladder Pressure (cmH₂O)',
      this.handleTrimPreview.bind(this),
      Object.assign({ color: '#7c3aed' }, this.interactiveOptions)
    );
  }

  handleTrimPreview(trimPoints) {
    this.currentTrimPoints = Array.isArray(trimPoints)
      ? trimPoints.slice()
      : null;

    const selection = this.getSortedSelection();
    let message = 'Click twice on the chart to define a trim interval.';
    let messageType = 'info';

    if (selection && selection.length === 1) {
      message = 'Select a second point to finish the trim interval.';
    } else if (selection && selection.length === 2) {
      if (selection[0] === selection[1]) {
        message = 'Please choose two different points to create a valid range.';
        messageType = 'warning';
      } else {
        message = `Ready to trim ${this.formatInterval(selection)}.`;
        messageType = 'success';
      }
    }

    this.notifyChange({
      message,
      messageType,
    });
  }

  applyTrim() {
    const selection = this.getSortedSelection();

    if (!selection || selection.length !== 2) {
      this.notifyChange({
        message: 'Select two points on the interactive chart before applying a trim.',
        messageType: 'warning',
      });
      return false;
    }

    if (selection[0] === selection[1]) {
      this.notifyChange({
        message: 'Please choose two different points to create a valid range.',
        messageType: 'warning',
      });
      return false;
    }

    this.trimIntervals.push(selection);
    this.currentTrimPoints = null;

    this.recalculateTrimmedData();
    this.renderPrimaryChart();
    this.initializeInteractiveChart();

    this.notifyChange({
      message: `Trim applied (${this.formatInterval(selection)}).`,
      messageType: 'success',
    });

    return true;
  }

  undoLastTrim() {
    if (!this.trimIntervals.length) {
      this.notifyChange({
        message: 'There are no trims to undo.',
        messageType: 'info',
      });
      return false;
    }

    const removed = this.trimIntervals.pop();
    this.recalculateTrimmedData();
    this.renderPrimaryChart();
    this.initializeInteractiveChart();

    this.notifyChange({
      message: `Removed trim ${this.formatInterval(removed)}.`,
      messageType: 'info',
    });

    return true;
  }

  restoreOriginal() {
    if (!this.trimIntervals.length) {
      this.notifyChange({
        message: 'The chart is already showing the original data.',
        messageType: 'info',
      });
      return false;
    }

    this.trimIntervals = [];
    this.currentTrimPoints = null;
    this.trimmedData = this.originalData.slice();
    this.renderPrimaryChart();
    this.initializeInteractiveChart();

    this.notifyChange({
      message: 'All trims have been cleared and the original data restored.',
      messageType: 'info',
    });

    return true;
  }

  recalculateTrimmedData() {
    this.trimmedData = this.originalData.filter((point) =>
      this.trimIntervals.every(([start, end]) => {
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        return (
          point['Elapsed Time'] < min || point['Elapsed Time'] > max
        );
      })
    );
  }

  getSortedSelection() {
    if (!this.currentTrimPoints || !this.currentTrimPoints.length) {
      return null;
    }

    return this.currentTrimPoints.slice().sort((a, b) => a - b);
  }

  getIntervals() {
    return this.trimIntervals.map(([start, end], index) => ({
      index,
      start: Math.min(start, end),
      end: Math.max(start, end),
    }));
  }

  formatInterval(interval) {
    if (!interval || interval.length < 2) {
      return '';
    }

    const [start, end] = interval;
    return `${start.toFixed(2)} – ${end.toFixed(2)} s`;
  }

  notifyChange(overrides = {}) {
    if (typeof this.onChange !== 'function') {
      return;
    }

    const selection = this.getSortedSelection();
    this.onChange(
      Object.assign(
        {
          trimmedData: this.trimmedData.slice(),
          intervals: this.getIntervals(),
          selection,
          isSelectionValid:
            Array.isArray(selection) &&
            selection.length === 2 &&
            selection[0] !== selection[1],
          hasTrims: this.trimIntervals.length > 0,
        },
        overrides
      )
    );
  }
}
