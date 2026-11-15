// Oficio de fábrica (15-11-2026): plantillas y habilidades sacadas de los procedimientos (SOP) que usa el equipo de HUGLE
// en su propia tienda, en versión genérica para cualquier negocio. Se añaden una sola vez (ajuste «oficio») y el usuario
// las puede editar o borrar como las suyas; nunca se pisan las que ya tenga con el mismo nombre.
import * as db from './db.js';

export const PLANTILLAS_OFICIO = [
  { nombre: 'Confirmar un pedido', canal: 'whatsapp', texto: 'Hola {{nombre}}, soy el asistente de {{negocio}}. Tenemos tu pedido listo para preparar. ¿Nos confirmas que los datos de entrega están bien? Si quieres cambiar algo o cancelarlo, dímelo por aquí y lo hacemos sin coste.' },
  { nombre: 'Duda: «¿y si no me convence?»', canal: 'cualquiera', texto: 'Es normal la duda, {{nombre}}. Tienes 14 días para devolverlo desde que lo recibes. Si quieres, te cuento cómo se hace para que lo tengas claro antes de decidir.' },
  { nombre: 'Entrega fallida o ausente', canal: 'whatsapp', texto: 'Hola {{nombre}}, el repartidor no pudo entregarte el pedido. ¿Te viene bien que lo intente de nuevo? Dime qué día y franja te vienen mejor y lo organizamos.' },
  { nombre: 'Cambio de dirección', canal: 'whatsapp', texto: 'Claro, {{nombre}}. Pásame la dirección nueva completa (calle, número, piso, código postal y población) y lo cambiamos antes de que salga el pedido.' },
  { nombre: 'Respuesta a una queja', canal: 'cualquiera', texto: 'Siento lo que ha pasado, {{nombre}}, y gracias por contárnoslo. Lo reviso ahora mismo con tu pedido y te digo hoy qué solución te damos.' },
  { nombre: 'Pedir una reseña', canal: 'cualquiera', texto: 'Hola {{nombre}}, ¿qué tal con tu compra en {{negocio}}? Si te ha gustado, una reseña corta nos ayuda muchísimo. Y si algo no te ha convencido, cuéntamelo a mí primero y lo arreglamos.' },
  { nombre: 'Carrito o formulario a medias', canal: 'cualquiera', texto: 'Hola {{nombre}}, vi que te quedaste a medias con tu pedido. ¿Te surgió alguna duda con el envío o el pago? Te la resuelvo en un momento.' },
];

// Habilidades guardadas (como las que enseña el usuario): se activan con su frase. «nota» es el procedimiento.
export const HABILIDADES_OFICIO = [
  { agente: 'atencion', nombre: 'Guion de objeciones', frase: 'guion de objeciones', pasos: ['faq'],
    nota: 'Cómo responder una objeción (SOP):\n1. Reconoce la duda sin discutirla.\n2. Da el dato real (plazo, forma de pago, devolución). Si no lo sabes, dilo y búscalo; nunca inventes fechas ni estados de envío.\n3. Ofrece una salida concreta: confirmar, cambiar o cancelar sin coste.\n4. Habla del producto y del pedido, nunca de la persona («depende de ti», «te verán…»).\n5. Si hay enfado, queja repetida, salud o una reclamación formal, pásalo a una persona.' },
  { agente: 'atencion', nombre: 'Protocolo de quejas', frase: 'protocolo de quejas', pasos: ['quejas'],
    nota: 'Protocolo (SOP): responde el mismo día · reconoce y pide perdón por la experiencia, no discutas · mira el pedido real antes de prometer · da UNA solución con fecha · apunta la queja en la ficha · si es la segunda vez o pide hablar con alguien, escala a una persona.' },
  { agente: 'atencion', nombre: 'Buenas prácticas del asistente', frase: 'reglas del asistente', pasos: [],
    nota: 'El cliente debe saber que habla con un asistente automático (Reglamento europeo de IA). No pidas tarjeta, cuenta, DNI ni datos que ya dio, y no repitas su dirección completa. En mensajes de pedido no metas ofertas ni publicidad sin su permiso (LSSI art. 21). Sin promesas que no controlas: fechas exactas, llamadas o descuentos.' },
  { agente: 'ventas', nombre: 'Seguimiento en 3 toques', frase: 'seguimiento en 3 toques', pasos: ['seguimientos'],
    nota: 'Cadencia (SOP): toque 1 a las 24-48 h con una pregunta concreta · toque 2 a los 3-4 días aportando algo útil (ejemplo, caso, respuesta a su duda) · toque 3 a la semana para cerrar con educación («¿lo dejamos para más adelante?»). Un solo objetivo por mensaje y nada de urgencias falsas.' },
  { agente: 'ventas', nombre: 'Persuasión honesta', frase: 'persuasion honesta', pasos: [],
    nota: 'Antes de vender, nombra la duda real del cliente (¿me fío?, ¿y si no me gusta?, ¿cómo pago?) y usa UNA palanca que la responda con un dato verdadero: menos riesgo (devolución, pago seguro), prueba social real o el uso concreto. Filtro: ¿es verdad hoy?, ¿decidiría igual sabiendo cómo está hecho el mensaje?, ¿se apoya en una inseguridad?, ¿mete prisa sin motivo? Si falla una, se cambia.' },
  { agente: 'fidelizacion', nombre: 'Pedir reseñas', frase: 'pedir resenas', pasos: ['mejores'],
    nota: 'Pide la reseña cuando el cliente ya tiene el producto (3-7 días después de recibirlo), con la plantilla «Pedir una reseña». Solo reseñas reales: nunca las inventes, no las compres ni premies solo las buenas. Si alguien no está contento, atiéndelo primero en privado.' },
  { agente: 'fidelizacion', nombre: 'Medir bien una campaña', frase: 'medir campana', pasos: ['segmentos'],
    nota: 'Mide sobre ventas cerradas (cobradas o entregadas), no sobre pedidos creados. Cada cifra con periodo, fuente y comparación con la semana anterior. Con menos de 30 casos, dilo: «sin datos suficientes». Antes de hablar de anomalía, descarta un fallo de medición.' },
];

// Se llama al arrancar: añade lo que falte una sola vez por versión del oficio
export async function sembrarOficio() {
  const VERSION = 1;
  if ((await db.ajuste('oficio')) >= VERSION) return;
  const tienen = new Set((await db.todos('plantillas')).map((p) => p.nombre));
  const nuevas = PLANTILLAS_OFICIO.filter((p) => !tienen.has(p.nombre)).map((p) => ({ ...p, oficio: true }));
  if (nuevas.length) await db.guardarVarios('plantillas', nuevas);
  const hab = new Set((await db.todos('habilidades')).map((h) => h.nombre));
  const nuevasH = HABILIDADES_OFICIO.filter((h) => !hab.has(h.nombre)).map((h) => ({ ...h, usos: 0, oficio: true }));
  if (nuevasH.length) await db.guardarVarios('habilidades', nuevasH);
  await db.fijar('oficio', VERSION);
}
