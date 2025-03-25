let allFrequencies = [];
let allAmplitudes = [];
let fileNames = [];
async function uploadFiles() {
    const files = document.getElementById('files').files;
    if (files.length === 0) {
        alert('Пожалуйста, выберите файлы для загрузки');
        return;
    }

    const formData = new FormData();
    for (let file of files) {
        formData.append('files', file);
    }

    try {
        const response = await fetch('/upload_files', {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();

        if (result.frequencies && result.amplitudes) {
            // Конвертация данных в числовой формат
            allFrequencies = result.frequencies.map(arr => arr.map(Number));
            allAmplitudes = result.amplitudes.map(arr => arr.map(Number));
            fileNames = result.files; 

            // Теперь передаём явные пустые значения для необязательных параметров
            plotCombinedSpectrum(
                allFrequencies, 
                allAmplitudes, 
                fileNames, 
                new Array(allFrequencies.length).fill([]), // пустые пики для каждого файла
                [], // mean_amplitude
                [], // std_amplitude
                false, 
                [], // boxplotStats
                "Исходные спектры"
            );

            alert(`Успешно загружено ${result.files.length} файлов`);
        } else {
            throw new Error(result.error || 'Неизвестная ошибка при загрузке');
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        alert('Ошибка: ' + error.message);
    }
}


async function processAndPlot() {
    console.log("Обработка данных...");

    if (allFrequencies.length === 0 || allAmplitudes.length === 0) {
        alert("Данные не загружены. Сначала загрузите файлы.");
        return;
    }

    try {
        // Получение числовых значений из input-полей с проверкой пустых значений
        const getNumberValue = (id, defaultValue) => {
            const val = document.getElementById(id).value;
            return val === '' ? defaultValue : Number(val);
        };

        const params = {
            frequencies: allFrequencies,
            amplitudes: allAmplitudes,
            remove_baseline: document.getElementById('remove_baseline').checked,
            apply_smoothing: document.getElementById('apply_smoothing').checked,
            normalize: document.getElementById('normalize').checked,
            find_peaks: document.getElementById('find_peaks').checked,
            calculate_mean_std: document.getElementById('calculate_mean_std').checked,
            calculate_boxplot: document.getElementById('calculate_boxplot').checked,
            lam: getNumberValue('lam', 1000),
            p: getNumberValue('p', 0.001),
            window_length: getNumberValue('window_length', 25),
            polyorder: getNumberValue('polyorder', 2),
            width: getNumberValue('peak_width', 1),
            prominence: getNumberValue('peak_prominence', 1),
            min_freq: getNumberValue('min_freq', 0),
            max_freq: getNumberValue('max_freq', 10000),
        };

        const response = await fetch('/process_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ошибка сервера: ${response.status} ${errorText}`);
        }

        const result = await response.json();

        plotCombinedSpectrum(
            result.frequencies,
            result.processed_amplitudes,
            fileNames,
            result.peaks || [],
            result.mean_amplitude || [],
            result.std_amplitude || [],
            document.getElementById('show_only_mean_std').checked,
            result.boxplot_stats || [],
            "Обработанные спектры"
        );

    } catch (error) {
        console.error("Ошибка:", error);
        alert("Ошибка обработки: " + error.message);
    }
}


function plotCombinedSpectrum(allFrequencies, allAmplitudes, fileNames, allPeaks, mean_amplitude, std_amplitude, showOnlyMeanStd, boxplotStats, title) {
    const plotData = [];
    const lineColors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'];

    // Линейные графики для каждого файла
    if (!showOnlyMeanStd) {
        for (let i = 0; i < allFrequencies.length; i++) {
            plotData.push({
                x: allFrequencies[i],
                y: allAmplitudes[i],
                type: 'scatter',
                mode: 'lines',
                name: truncateFileName(fileNames[i]) || `Файл ${i + 1}`,
                line: { 
                    color: lineColors[i % lineColors.length],
                    width: 1
                },
                yaxis: 'y1'
            });
        
            if (allPeaks[i] && allPeaks[i].length > 0) {
                plotData.push({
                    x: allPeaks[i].map(index => allFrequencies[i][index]),
                    y: allPeaks[i].map(index => allAmplitudes[i][index]),
                    type: 'scatter',
                    mode: 'markers',
                    name: `Пики ${truncateFileName(fileNames[i]) || `Файл ${i + 1}`}`,
                    marker: { color: lineColors[i % lineColors.length], size: 8, symbol: 'circle-open' },
                    yaxis: 'y1'
                });
            }
        }
    }

    // Среднее значение и стандартное отклонение
    if (mean_amplitude && mean_amplitude.length > 0 && std_amplitude && std_amplitude.length > 0) {
        plotData.push(
            {
                x: allFrequencies[0],
                y: mean_amplitude,
                type: 'scatter',
                mode: 'lines',
                name: 'Среднее значение',
                line: { color: 'red', width: 3 },
                yaxis: 'y1'
            },
            {
                x: allFrequencies[0],
                y: mean_amplitude.map((m, i) => m + std_amplitude[i]),
                type: 'scatter',
                mode: 'lines',
                name: 'Среднее + 1σ',
                line: { color: 'orange', width: 2, dash: 'dot' },
                yaxis: 'y1'
            },
            {
                x: allFrequencies[0],
                y: mean_amplitude.map((m, i) => m - std_amplitude[i]),
                type: 'scatter',
                mode: 'lines',
                name: 'Среднее - 1σ',
                line: { color: 'orange', width: 2, dash: 'dot' },
                yaxis: 'y1'
            }
        );
    }

    // Box plots
    if (boxplotStats && boxplotStats.length > 0) {
        const positions = [];
        const step = (allFrequencies[0][allFrequencies[0].length - 1] - allFrequencies[0][0]) / (allFrequencies.length + 1);

        for (let i = 0; i < allFrequencies.length; i++) {
            positions.push(allFrequencies[0][0] + (i + 1) * step);
        }

        plotData.push({
            y: allAmplitudes.flat(),
            x: positions.flatMap((pos, i) => Array(allAmplitudes[i].length).fill(pos)),
            type: 'box',
            name: 'Распределение',
            boxpoints: 'all',
            jitter: 0.5,
            pointpos: 0,
            marker: { size: 3, opacity: 0.5 },
            line: { width: 1 },
            fillcolor: 'rgba(100, 100, 255, 0.3)',
            yaxis: 'y1',
            hoverinfo: 'y+name',
            showlegend: false
        });
    }

    const layout = {
        title: title,
        xaxis: { title: 'Волновое число (см⁻¹)' },
        yaxis: { title: 'Интенсивность (Отнс. ед.)' },
        plot_bgcolor: document.body.classList.contains('dark-theme') ? '#1e1e1e' : '#ffffff',
        paper_bgcolor: document.body.classList.contains('dark-theme') ? '#1e1e1e' : '#ffffff',
        font: { color: document.body.classList.contains('dark-theme') ? '#e0e0e0' : '#222' },
        showlegend: true,
        legend: {
            orientation: 'v',
            y: 1,
            x: 1.02,
            yanchor: 'top',
            xanchor: 'left'
        },
        margin: { l: 60, r: 150, b: 60, t: 80, pad: 4 }
    };

    Plotly.newPlot('spectrum_plot', plotData, layout);
}

function updatePlotTheme() {
    const plotElement = document.getElementById('spectrum_plot');
    if (!plotElement || !plotElement.data) return;

    const currentLayout = plotElement.layout;

    const updatedLayout = {
        ...currentLayout,
        plot_bgcolor: document.body.classList.contains('dark-theme') ? '#1e1e1e' : '#ffffff',
        paper_bgcolor: document.body.classList.contains('dark-theme') ? '#1e1e1e' : '#ffffff',
        font: {
            color: document.body.classList.contains('dark-theme') ? '#e0e0e0' : '#222'
        },
        xaxis: {
            ...currentLayout.xaxis,
            color: document.body.classList.contains('dark-theme') ? '#e0e0e0' : '#222',
            title: currentLayout.xaxis.title.text
        },
        yaxis: {
            ...currentLayout.yaxis,
            color: document.body.classList.contains('dark-theme') ? '#e0e0e0' : '#222',
            title: currentLayout.yaxis.title.text
        },
        legend: {
            ...currentLayout.legend,
            font: {
                color: document.body.classList.contains('dark-theme') ? '#e0e0e0' : '#222'
            }
        }
    };

    Plotly.react('spectrum_plot', plotElement.data, updatedLayout);
}

function truncateFileName(name, length = 20) {
    return name.length > length ? name.slice(0, length - 3) + '...' : name;
}

document.addEventListener('DOMContentLoaded', function() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark-theme');
            updatePlotTheme();
        });
    }
});