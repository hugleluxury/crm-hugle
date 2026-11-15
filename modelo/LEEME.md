# Modelo de IA incluido (HGLmini1.2flash)

**HGLmini1.2flash** es MNN-Pocket-0.3B-Instruct (Alibaba Taobao MNN, Apache-2.0, ver `LICENSE`) **destilado** para las tareas
del CRM: un modelo maestro grande (Qwen3.6-35B-A3B, Apache-2.0) generó 3.617 ejemplos en español de España con los mismos
prompts que usa la app (clasificar mensajes, sacar contactos, enrutar preguntas, elegir herramienta de los agentes,
redactar WhatsApp y respuestas libres) y con ellos se ajustó el modelo entero. Se exporta en Q4_1, con **el mismo tamaño** que el original.

- Modelo base: https://huggingface.co/taobao-mnn/MNN-Pocket-0.3B-GGUF
- Tamaño: 191 896 544 bytes, troceado en 4 partes de 48 MB (GitHub no admite archivos de más de 100 MB).
- SHA-256 del archivo completo: `70e1f6b7662636517dc87b0350ef7a2faca3ffa48887ce1a457e78a515a41354`

## Examen (327 casos que el modelo no vio al entrenar, % de respuestas que el CRM puede usar)

| Tarea | HGLmini1.1flash | HGLmini1.2flash |
|---|---|---|
| Clasificar mensajes | 18,4 | 91,1 |
| Sacar contactos | 22,5 | 88,3 |
| Enrutar preguntas del chat | 30,2 | 88,4 |
| Elegir herramienta (agentes) | 5,6 | 69,4 |
| Redactar WhatsApp | 51,3 | 100 |
| Respuesta libre | 85,7 | 100 |
| **Media** | **35,6** | **89,5** |

El CRM une las partes en el dispositivo la primera vez que se abre y las guarda en el navegador: a partir de ahí la IA funciona sin internet.
Para rehacer el `.gguf`: `cat hglmini-1.2-flash.parte1 hglmini-1.2-flash.parte2 hglmini-1.2-flash.parte3 hglmini-1.2-flash.parte4 > hglmini-1.2-flash.gguf` (en Windows: `copy /b hglmini-1.2-flash.parte1+hglmini-1.2-flash.parte2+hglmini-1.2-flash.parte3+hglmini-1.2-flash.parte4 hglmini-1.2-flash.gguf`).
