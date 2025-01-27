# Используем официальный образ Python
FROM python:3.9-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файлы проекта в контейнер
COPY . .

# Устанавливаем зависимости
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Делаем скрипт исполняемым
RUN chmod +x app.py

# Указываем команду для запуска приложения
CMD ["python", "app.py"]