# Modelo de IA incluido (HGLmini1.1flash)

Pesos de **MNN-Pocket-0.3B-Instruct-Q4_1.gguf** (Alibaba Taobao MNN, Apache-2.0, ver `LICENSE`),
sin modificar, troceados en 4 partes de 48 MB para poder alojarlos junto a la app (GitHub no admite archivos de más de 100 MB).

- Origen: https://huggingface.co/taobao-mnn/MNN-Pocket-0.3B-GGUF
- Tamaño: 191 896 672 bytes
- SHA-256 del archivo completo: `a281c127e388b16537fd3f5d31ab32d3f87739e6dc514ac1093c80d9eac8d097`

El CRM las une en el dispositivo la primera vez que se abre y las guarda en el navegador: a partir de ahí la IA funciona sin internet.
Para rehacer el `.gguf` original: `cat hglmini-1.1-flash.parte1 hglmini-1.1-flash.parte2 hglmini-1.1-flash.parte3 hglmini-1.1-flash.parte4 > MNN-Pocket-0.3B-Instruct-Q4_1.gguf` (en Windows: `copy /b hglmini-1.1-flash.parte1+hglmini-1.1-flash.parte2+hglmini-1.1-flash.parte3+hglmini-1.1-flash.parte4 modelo.gguf`).
