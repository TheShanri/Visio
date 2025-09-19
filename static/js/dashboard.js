(function () {
  const fileInput = document.getElementById('file-upload');
  const dropZone = document.querySelector('[data-dropzone]');
  const fileNameDisplay = document.getElementById('file-name');
  const uploadButton = document.getElementById('uploadButton');
  const uploadForm = document.getElementById('uploadForm');

  function updateFileName(file) {
    if (!fileNameDisplay) {
      return;
    }

    fileNameDisplay.textContent = file ? file.name : 'No file selected yet';
  }

  function toggleUploadButton(enabled) {
    if (!uploadButton) {
      return;
    }

    uploadButton.disabled = !enabled;
  }

  function handleFiles(files) {
    if (!files || !files.length || !fileInput) {
      return;
    }

    const file = files[0];
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    updateFileName(file);
    toggleUploadButton(true);
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const [file] = fileInput.files;
      updateFileName(file || null);
      toggleUploadButton(Boolean(file));
    });
  }

  if (dropZone) {
    ['dragenter', 'dragover'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.add('is-active');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.remove('is-active');
      });
    });

    dropZone.addEventListener('drop', (event) => {
      const files = event.dataTransfer?.files;
      if (files?.length) {
        handleFiles(files);
      }
    });

    dropZone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        fileInput?.click();
      }
    });
  }

  if (uploadForm) {
    uploadForm.addEventListener('submit', () => {
      if (uploadButton) {
        uploadButton.disabled = true;
        uploadButton.textContent = 'Processing…';
      }
    });
  }

  const dataElement = document.getElementById('chart-data');
  if (!dataElement) {
    return;
  }

  let parsedData;
  try {
    parsedData = JSON.parse(dataElement.textContent);
  } catch (error) {
    console.error('Unable to parse chart data', error);
    return;
  }

  const series = {
    scale: prepareSeries(parsedData?.scale, 'Scale'),
    volume: prepareSeries(parsedData?.volume, 'Tot Infused Vol'),
    pressure: Array.isArray(parsedData?.pressure)
      ? parsedData.pressure
      : [],
  };

  renderLineCharts(series);
  renderSummary(series);
  initialiseTrimmer(series.pressure);

  function prepareSeries(collection, valueKey) {
    if (!Array.isArray(collection)) {
      return { x: [], y: [] };
    }

    return collection.reduce(
      (accumulator, item) => {
        const x = Number(item['Elapsed Time']);
        const y = Number(item[valueKey]);

        if (Number.isFinite(x) && Number.isFinite(y)) {
          accumulator.x.push(x);
          accumulator.y.push(y);
        }

        return accumulator;
      },
      { x: [], y: [] }
    );
  }

  function renderLineCharts(series) {
    const scaleOptions = {
      color: '#0ea5e9',
      tooltipFormatter: (x, y) => `Elapsed Time: ${x.toFixed(2)} s\nScale: ${y.toFixed(2)}`,
    };

    const volumeOptions = {
      color: '#22c55e',
      tooltipFormatter: (x, y) => `Elapsed Time: ${x.toFixed(2)} s\nTotal Infused Vol: ${y.toFixed(2)} mL`,
    };

    new LineChart(
      '#chart-scale',
      series.scale.x,
      series.scale.y,
      'Elapsed Time (s)',
      'Scale',
      scaleOptions
    );

    new LineChart(
      '#chart-volume',
      series.volume.x,
      series.volume.y,
      'Elapsed Time (s)',
      'Total Infused Volume (mL)',
      volumeOptions
    );
  }

  function renderSummary(series) {
    const container = document.getElementById('summary-cards');
    if (!container) {
      return;
    }

    const duration = getDuration(series.scale.x);
    const peakPressure = getExtreme(series.pressure, 'Bladder Pressure', Math.max);
    const totalVolume = getExtreme(series.volume.y, null, Math.max);
    const dataPoints = series.scale.x.length || series.volume.x?.length || 0;

    const metrics = [
      duration !== null && {
        label: 'Study duration',
        value: formatDuration(duration),
        hint: 'From first to last recorded timestamp',
      },
      peakPressure !== null && {
        label: 'Peak bladder pressure',
        value: `${formatNumber(peakPressure)} cmH₂O`,
        hint: 'Maximum reading across trimmed data',
      },
      totalVolume !== null && {
        label: 'Total infused volume',
        value: `${formatNumber(totalVolume)} mL`,
        hint: 'Cumulative infusion at study completion',
      },
      dataPoints && {
        label: 'Data points analysed',
        value: formatNumber(dataPoints),
        hint: 'Valid entries used to build the charts',
      },
    ].filter(Boolean);

    if (!metrics.length) {
      container.innerHTML = `
        <div class="metric-chip">
          <span>—</span>
          <span>Awaiting metrics<br />Upload data to see insights</span>
        </div>
      `;
      return;
    }

    container.innerHTML = metrics
      .map(
        (metric) => `
          <div class="metric-chip">
            <span>${metric.value}</span>
            <span>${metric.label}<br />${metric.hint}</span>
          </div>
        `
      )
      .join('');
  }

  function getDuration(values) {
    if (!Array.isArray(values) || !values.length) {
      return null;
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    return max - min;
  }

  function getExtreme(collection, key, comparator) {
    if (Array.isArray(collection) && collection.length) {
      if (key) {
        const values = collection
          .map((item) => Number(item[key]))
          .filter((value) => Number.isFinite(value));
        return values.length ? comparator(...values) : null;
      }
      const values = collection.filter((value) => Number.isFinite(value));
      return values.length ? comparator(...values) : null;
    }
    return null;
  }

  function formatDuration(duration) {
    if (!Number.isFinite(duration)) {
      return '—';
    }
    if (duration < 60) {
      return `${duration.toFixed(1)} s`;
    }
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}m ${seconds.toFixed(0)}s`;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: value < 100 ? 2 : 0,
    }).format(value);
  }

  function initialiseTrimmer(pressureSeries) {
    const trimButton = document.getElementById('trimGraphButton');
    const modal = document.getElementById('trimGraphModal');
    const applyButton = document.getElementById('applyTrimButton');
    const undoButton = document.getElementById('undoTrimButton');
    const restoreButton = document.getElementById('restoreOriginalButton');
    const trimSummary = document.getElementById('trim-summary');
    const trimStatus = document.getElementById('trim-status');

    if (!Array.isArray(pressureSeries) || !pressureSeries.length) {
      if (trimButton) {
        trimButton.disabled = true;
      }
      if (trimStatus) {
        trimStatus.textContent = 'Bladder pressure data was not detected in this file.';
        trimStatus.setAttribute('data-status-type', 'warning');
      }
      return;
    }

    const trimmer = new Trimmer(pressureSeries, '#chart-pressure', '#chart-pressure-interactive', handleTrimStateChange, {
      lineChartOptions: {
        color: '#7c3aed',
        tooltipFormatter: (x, y) => `Elapsed Time: ${x.toFixed(2)} s\nBladder Pressure: ${y.toFixed(2)} cmH₂O`,
      },
      interactiveOptions: {
        color: '#7c3aed',
      },
    });

    if (trimButton) {
      trimButton.addEventListener('click', () => openModal(modal));
    }

    if (modal) {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          closeModal(modal);
        }
      });
      modal
        .querySelectorAll('[data-close-modal]')
        .forEach((button) => button.addEventListener('click', () => closeModal(modal)));
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal?.classList.contains('is-open')) {
        closeModal(modal);
      }
    });

    applyButton?.addEventListener('click', () => trimmer.applyTrim());
    undoButton?.addEventListener('click', () => trimmer.undoLastTrim());
    restoreButton?.addEventListener('click', () => trimmer.restoreOriginal());

    function handleTrimStateChange(state) {
      if (!state) {
        return;
      }

      if (applyButton) {
        applyButton.disabled = !state.isSelectionValid;
      }
      if (undoButton) {
        undoButton.disabled = !state.hasTrims;
      }
      if (restoreButton) {
        restoreButton.disabled = !state.hasTrims;
      }

      if (trimSummary) {
        if (!state.intervals?.length) {
          trimSummary.innerHTML = '<li><span>No trims applied yet</span><span></span></li>';
        } else {
          trimSummary.innerHTML = state.intervals
            .map(
              (interval, index) => `
                <li>
                  <span>Trim ${index + 1}</span>
                  <span>${formatInterval(interval)}</span>
                </li>
              `
            )
            .join('');
        }
      }

      if (trimStatus) {
        if (state.message) {
          trimStatus.textContent = state.message;
        }
        trimStatus.setAttribute('data-status-type', state.messageType || 'info');
      }
    }
  }

  let lastActiveElement = null;

  function openModal(modal) {
    if (!modal) {
      return;
    }
    lastActiveElement = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const focusable = modal.querySelector('button:not(:disabled)');
    focusable?.focus();
  }

  function closeModal(modal) {
    if (!modal) {
      return;
    }
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    lastActiveElement?.focus();
  }

  function formatInterval(interval) {
    const start = Number(interval.start);
    const end = Number(interval.end);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return '—';
    }

    return `${start.toFixed(2)} – ${end.toFixed(2)} s`;
  }
})();
