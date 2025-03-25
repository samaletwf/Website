let allFrequencies = [];
let allAmplitudes = [];

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
        console.log('Результат загрузки:', result);

        if (result.frequencies && result.amplitudes) {
            allFrequencies = result.frequencies;
            allAmplitudes = result.amplitudes;
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
        const params = {
            frequencies: allFrequencies,
            amplitudes: allAmplitudes,
            remove_baseline: document.getElementById('remove_baseline').checked,
            apply_smoothing: document.getElementById('apply_smoothing').checked,
            normalize: document.getElementById('normalize').checked,
            find_peaks: document.getElementById('find_peaks').checked,
            calculate_mean_std: document.getElementById('calculate_mean_std').checked,
            calculate_boxplot: document.getElementById('calculate_boxplot').checked,
            lam: parseFloat(document.getElementById('lam').value) || 1000,
            p: parseFloat(document.getElementById('p').value) || 0.001,
            window_length: parseInt(document.getElementById('window_length').value) || 25,
            polyorder: parseInt(document.getElementById('polyorder').value) || 2,
            width: parseFloat(document.getElementById('peak_width').value) || 1,
            prominence: parseFloat(document.getElementById('peak_prominence').value) || 1,
            min_freq: parseFloat(document.getElementById('min_freq').value) || 0,
            max_freq: parseFloat(document.getElementById('max_freq').value) || 10000,
        };

        console.log("Отправка параметров:", params);
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
        console.log("Получены данные:", result);

        plotCombinedSpectrum(
            result.frequencies, 
            result.processed_amplitudes, 
            result.peaks, 
            result.mean_amplitude, 
            result.std_amplitude,
            document.getElementById('show_only_mean_std').checked,
            result.boxplot_stats
        );
        
    } catch (error) {
        console.error("Ошибка:", error);
        alert("Ошибка обработки: " + error.message);
    }
}

function plotCombinedSpectrum(allFrequencies, allAmplitudes, allPeaks, mean_amplitude, std_amplitude, showOnlyMeanStd, boxplotStats) {
    const plotData = [];
    const lineColors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'];
    
    // 1. Сначала добавляем линейные графики и среднее/СКО
    if (!showOnlyMeanStd) {
        for (let i = 0; i < allFrequencies.length; i++) {
            plotData.push({
                x: allFrequencies[i],
                y: allAmplitudes[i],
                type: 'scatter',
                mode: 'lines',
                name: `Файл ${i + 1}`,
                line: { 
                    color: lineColors[i % lineColors.length],
                    width: 1
                },
                yaxis: 'y1'
            });
        }
    }

    // Графики среднего и СКО
    if (mean_amplitude && mean_amplitude.length > 0) {
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

    // 2. Добавляем box plots на отдельной оси Y справа
    if (boxplotStats && boxplotStats.length > 0) {
        // Создаем позиции для box plots вдоль оси X
        const positions = [];
        const step = (allFrequencies[0][allFrequencies[0].length-1] - allFrequencies[0][0]) / (allFrequencies.length + 1);
        
        for (let i = 0; i < allFrequencies.length; i++) {
            positions.push(allFrequencies[0][0] + (i + 1) * step);
        }

        plotData.push({
            y: allAmplitudes.flat(), // Объединяем все амплитуды
            x: positions.flatMap((pos, i) => Array(allAmplitudes[i].length).fill(pos)),
            type: 'box',
            name: 'Распределение',
            boxpoints: 'all',
            jitter: 0.5,
            pointpos: 0,
            marker: {
                size: 3,
                opacity: 0.5
            },
            line: { width: 1 },
            fillcolor: 'rgba(100, 100, 255, 0.3)',
            yaxis: 'y1', // Используем ту же ось Y
            hoverinfo: 'y+name',
            showlegend: false
        });
    }

    const layout = {
        title: 'Спектры с распределением амплитуд',
        xaxis: {
            title: 'Волновое число (см^-1)',
            range: [allFrequencies[0][0], allFrequencies[0][allFrequencies[0].length-1]]
        },
        yaxis: {
            title: 'Интенсивность (Отнс. ед.)',
            side: 'left',
            showgrid: true
        },
        plot_bgcolor: document.body.classList.contains('dark-theme') ? '#1e1e1e' : '#ffffff',
        paper_bgcolor: document.body.classList.contains('dark-theme') ? '#1e1e1e' : '#ffffff',
        font: {
            color: document.body.classList.contains('dark-theme') ? '#e0e0e0' : '#222'
        },
        boxmode: 'overlay',
        showlegend: true,
        legend: {
            orientation: 'h',
            y: 1.1,
            x: 0.5,
            xanchor: 'center'
        },
        margin: {
            l: 50,
            r: 50,
            b: 50,
            t: 80,
            pad: 4
        }
    };

    Plotly.newPlot('spectrum_plot', plotData, layout);
}
function updatePlotTheme() {
    const plotElement = document.getElementById('spectrum_plot');
    if (!plotElement || !plotElement.data) return;
    
    Plotly.react('spectrum_plot', plotElement.data, {
        plot_bgcolor: document.body.classList.contains('dark-theme') ? '#1e1e1e' : '#ffffff',
        paper_bgcolor: document.body.classList.contains('dark-theme') ? '#1e1e1e' : '#ffffff',
        font: {
            color: document.body.classList.contains('dark-theme') ? '#e0e0e0' : '#222'
        }
    });
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