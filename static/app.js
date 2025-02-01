let allFrequencies = [];
let allAmplitudes = [];

async function uploadFiles() {
    const files = document.getElementById('files').files;
    const formData = new FormData();

    for (let file of files) {
        formData.append('files', file);
    }

    const response = await fetch('/upload_files', {
        method: 'POST',
        body: formData,
    });

    const result = await response.json();
    console.log(result);

    if (result.frequencies && result.amplitudes) {
        allFrequencies = result.frequencies;
        allAmplitudes = result.amplitudes;
        alert('Файлы успешно загружены!');
    } else {
        alert('Ошибка при загрузке файлов: ' + result.error);
    }
}

async function processAndPlot() {
    console.log("Кнопка обработки нажата.");

    if (allFrequencies.length === 0 || allAmplitudes.length === 0) {
        alert("Данные не загружены. Сначала загрузите файлы.");
        return;
    }

    const params = {
        frequencies: allFrequencies,
        amplitudes: allAmplitudes,
        remove_baseline: document.getElementById('remove_baseline').checked,
        apply_smoothing: document.getElementById('apply_smoothing').checked,
        normalize: document.getElementById('normalize').checked,
        find_peaks: document.getElementById('find_peaks').checked,
        lam: parseFloat(document.getElementById('lam').value) || 1000,
        p: parseFloat(document.getElementById('p').value) || 0.001,
        window_length: parseInt(document.getElementById('window_length').value) || 25,
        polyorder: parseInt(document.getElementById('polyorder').value) || 2,
        width: parseFloat(document.getElementById('peak_width').value) || 1,
        prominence: parseFloat(document.getElementById('peak_prominence').value) || 1,
        min_freq: parseFloat(document.getElementById('min_freq').value) || 0,
        max_freq: parseFloat(document.getElementById('max_freq').value) || 10000,
    };

    console.log("Параметры отправки:", params);

    try {
        const response = await fetch('/process_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Ответ сервера с ошибкой:", errorText);
            throw new Error(`Ошибка обработки данных: ${response.statusText}`);
        }

        const result = await response.json();
        console.log("Ответ от /process_data:", result);

        if (result.processed_amplitudes && Array.isArray(result.processed_amplitudes)) {
            plotCombinedSpectrum(result.frequencies, result.processed_amplitudes, result.peaks || []);
        } else {
            alert(`Ошибка обработки данных: ${result.error || "Неизвестная ошибка"}`);
        }
    } catch (error) {
        console.error("Ошибка в процессе обработки:", error);
        alert(`Ошибка при обработке данных: ${error.message || "Неизвестная ошибка"}`);
    }
}


// Функция построения графика
// Доступные темы
const plotlyThemes = ["plotly_white","plotly_dark"];
let currentTheme = "plotly_white"; // Тема по умолчанию

// Обновление графика с выбранной темой
function plotCombinedSpectrum(allFrequencies, allAmplitudes, allPeaks) {
    const plotData = [];
    const lineColors = ['blue', 'green', 'purple', 'pink', 'orange', 'teal', 'red', 'cyan', 'yellow', 'magenta'];

    for (let i = 0; i < allFrequencies.length; i++) {
        plotData.push({
            x: allFrequencies[i],
            y: allAmplitudes[i],
            type: 'scatter',
            mode: 'lines',
            name: `Файл ${i + 1}`,
            line: { color: lineColors[i % lineColors.length] }
        });

        if (allPeaks[i] && allPeaks[i].length > 0) {
            plotData.push({
                x: allPeaks[i].map(index => allFrequencies[i][index]),
                y: allPeaks[i].map(index => allAmplitudes[i][index]),
                type: 'scatter',
                mode: 'markers',
                name: `Пики файла ${i + 1}`,
                marker: { color: lineColors[i % lineColors.length], size: 8 }
            });
        }
    }

    const layout = {
        title: 'Сравнение спектров',
        xaxis: { title: 'Частота' },
        yaxis: { title: 'Амплитуда' },
        template: currentTheme // Применение текущей темы
    };

    const plotElement = document.getElementById('spectrum_plot');
    Plotly.purge(plotElement); // Удаление старого графика
    Plotly.newPlot('spectrum_plot', plotData, layout); // Создание нового графика
}

// Обработчик изменения темы
document.addEventListener('DOMContentLoaded', function () {
    const themeSelector = document.getElementById('theme-selector');
    themeSelector.addEventListener('change', function () {
        currentTheme = themeSelector.value; // Обновляем текущую тему
        if (allFrequencies.length && allAmplitudes.length) {
            plotCombinedSpectrum(allFrequencies, allAmplitudes, []); // Перестраиваем график с новой темой
        } else {
            alert('Данные не загружены. Пожалуйста, загрузите файлы.');
        }
    });
});
