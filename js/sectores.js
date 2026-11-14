// Sectores: lo que hace que los 3 agentes hablen y piensen como alguien del oficio.
// Cada sector ajusta el vocabulario, el ciclo de compra (cuándo un cliente está «en riesgo»), las etapas
// sugeridas del embudo, las preguntas frecuentes que conviene tener respondidas y los consejos de cada agente.
import * as db from './db.js';

const E = (id, nombre, color, tipo = 'abierta') => ({ id, nombre, color, tipo });
const CIERRE = [E('ganado', 'Ganado', '#28B995', 'ganada'), E('perdido', 'Perdido', '#F16B75', 'perdida')];

export const SECTORES = {
  general: {
    nombre: 'General / otro', cliente: 'cliente', clientes: 'clientes', ciclo: 60,
    faq: ['¿Cuáles son vuestros precios?', '¿Cuál es vuestro horario?', '¿Dónde estáis?', '¿Cómo se paga?', '¿Cuánto tarda?'],
    ideas: {
      ventas: ['Contesta a cada lead en menos de una hora: es cuando más se cierra.', 'Pon fecha de cierre a cada oportunidad y revisa las que se pasan.'],
      atencion: ['Guarda en Conocimiento las 5 preguntas que más te hacen: responderás en segundos.', 'Cierra cada conversación con un siguiente paso claro.'],
      fidelizacion: ['Después de cada venta, programa un mensaje a los 15–30 días.', 'Pide reseña a tus clientes más satisfechos justo después de la compra.'],
    },
  },
  tienda: {
    nombre: 'Tienda / comercio online', cliente: 'cliente', clientes: 'clientes', ciclo: 60,
    etapas: [E('nuevo', 'Interesado', '#20B8FF'), E('carrito', 'Carrito / dudas', '#4285F4'), E('pedido', 'Pedido en curso', '#9B7BDB'), ...CIERRE],
    faq: ['¿Cuánto tarda el envío?', '¿Cuánto cuesta el envío?', '¿Puedo devolverlo?', '¿Qué formas de pago aceptáis?', '¿Tenéis tallas o medidas?', '¿Hacéis envíos a mi zona?'],
    ideas: {
      ventas: ['Recupera los carritos y las dudas sin respuesta el mismo día.', 'Ofrece un pack o un segundo artículo con descuento a quien ya va a comprar.'],
      atencion: ['El 80 % de las dudas son envío, devoluciones y pago: tenlas respondidas en Conocimiento.', 'Confirma cada pedido por mensaje: baja las devoluciones y los rechazos.'],
      fidelizacion: ['Escribe cuando el producto se esté acabando (ciclo de recompra).', 'Premia la segunda compra: es la que convierte a un comprador en cliente.'],
    },
  },
  restauracion: {
    nombre: 'Restauración y hostelería', cliente: 'cliente', clientes: 'clientes', ciclo: 30,
    etapas: [E('nuevo', 'Consulta', '#20B8FF'), E('propuesta', 'Menú / presupuesto enviado', '#9B7BDB'), E('reserva', 'Reserva con señal', '#E3A64B'), ...CIERRE],
    faq: ['¿Tenéis mesa para hoy?', '¿Tenéis opciones sin gluten o veganas?', '¿Hacéis menús para grupos y eventos?', '¿Cuál es el horario de cocina?', '¿Se puede aparcar cerca?'],
    ideas: {
      ventas: ['Los eventos y grupos son el ticket más alto: haz seguimiento de cada presupuesto en 48 h.', 'Pide señal para confirmar reservas de grupo.'],
      atencion: ['Responde las reservas en menos de 15 minutos o el cliente reserva en otro sitio.', 'Ten respondidas las alergias e intolerancias: es la duda más delicada.'],
      fidelizacion: ['Felicita los cumpleaños con una invitación (postre o copa).', 'Quien no vuelve en un mes, olvida: manda una novedad de carta.'],
    },
  },
  salud: {
    nombre: 'Clínica, salud y estética', cliente: 'paciente', clientes: 'pacientes', ciclo: 180, cita: 'cita',
    etapas: [E('nuevo', 'Solicitud', '#20B8FF'), E('valoracion', 'Primera valoración', '#4285F4'), E('presupuesto', 'Presupuesto de tratamiento', '#9B7BDB'), E('tratamiento', 'En tratamiento', '#E3A64B'), ...CIERRE],
    faq: ['¿Cuánto cuesta la primera consulta?', '¿Trabajáis con mi seguro o mutua?', '¿Se puede financiar el tratamiento?', '¿Cuánto dura el tratamiento?', '¿Cómo cambio o anulo mi cita?'],
    ideas: {
      ventas: ['Muchos presupuestos de tratamiento se cierran con una segunda llamada: no la dejes pasar de 7 días.', 'Ofrece financiación en los presupuestos altos.'],
      atencion: ['Recuerda cada cita el día anterior: reduce los «no presentados».', 'Nunca des diagnósticos por mensaje: invita a la consulta.'],
      fidelizacion: ['Programa las revisiones periódicas (6 o 12 meses) como tarea al cerrar cada tratamiento.', 'Pide reseña al terminar un tratamiento con buen resultado.'],
    },
  },
  belleza: {
    nombre: 'Peluquería y belleza', cliente: 'clienta/e', clientes: 'clientes', ciclo: 45, cita: 'cita',
    faq: ['¿Tenéis hueco esta semana?', '¿Cuánto cuesta el corte o el color?', '¿Qué productos usáis?', '¿Cómo cambio mi cita?', '¿Hacéis bonos?'],
    ideas: {
      ventas: ['Propón la siguiente cita antes de que el cliente se vaya.', 'Vende bonos de varias sesiones: aseguran la repetición.'],
      atencion: ['Confirma las citas por WhatsApp el día antes.', 'Ten la lista de precios en Conocimiento para responder al momento.'],
      fidelizacion: ['Avisa cuando toque repetir (raíz, corte, manicura) según su última visita.', 'Premia a quien te recomienda.'],
    },
  },
  inmobiliaria: {
    nombre: 'Inmobiliaria', cliente: 'cliente', clientes: 'clientes', ciclo: 365,
    etapas: [E('nuevo', 'Contacto', '#20B8FF'), E('visita', 'Visita', '#4285F4'), E('oferta', 'Oferta', '#9B7BDB'), E('arras', 'Arras / reserva', '#E3A64B'), ...CIERRE],
    faq: ['¿El inmueble sigue disponible?', '¿Se puede visitar?', '¿Qué gastos tiene la compra?', '¿Ayudáis con la hipoteca?', '¿Cuál es vuestra comisión?'],
    ideas: {
      ventas: ['Tras cada visita, llama en 24 h para conocer la impresión del comprador.', 'Cruza los compradores activos con cada nueva captación.'],
      atencion: ['Responde a los portales en la primera hora: el comprador escribe a varias agencias.', 'Envía la ficha completa y fotos antes de la visita.'],
      fidelizacion: ['Un cliente que compra hoy vende en unos años: felicítale el aniversario de la compra.', 'Pide recomendaciones a cada cliente que firma.'],
    },
  },
  servicios: {
    nombre: 'Servicios profesionales y agencias', cliente: 'cliente', clientes: 'clientes', ciclo: 90,
    etapas: [E('nuevo', 'Contacto', '#20B8FF'), E('reunion', 'Reunión', '#4285F4'), E('propuesta', 'Propuesta enviada', '#9B7BDB'), E('negociacion', 'Negociación', '#E3A64B'), ...CIERRE],
    faq: ['¿Cuánto cuesta vuestro servicio?', '¿Cómo trabajáis?', '¿Cuánto tarda el proyecto?', '¿Tenéis ejemplos o casos de éxito?', '¿Cómo se factura?'],
    ideas: {
      ventas: ['Envía la propuesta en 48 h tras la reunión y agenda ya la llamada para comentarla.', 'Ofrece dos o tres opciones de precio: facilita decir que sí.'],
      atencion: ['Manda un resumen por escrito después de cada reunión.', 'Avisa antes de que el cliente pregunte: los retrasos se perdonan si se avisan.'],
      fidelizacion: ['Revisa los resultados con el cliente cada trimestre y propón el siguiente paso.', 'Pide un caso de éxito o una recomendación al cerrar bien un proyecto.'],
    },
  },
  reformas: {
    nombre: 'Reformas, instalaciones y oficios', cliente: 'cliente', clientes: 'clientes', ciclo: 365,
    etapas: [E('nuevo', 'Solicitud', '#20B8FF'), E('visita', 'Visita / medición', '#4285F4'), E('presupuesto', 'Presupuesto enviado', '#9B7BDB'), E('aceptado', 'Aceptado / en obra', '#E3A64B'), ...CIERRE],
    faq: ['¿Cuánto cuesta más o menos?', '¿Cuándo podéis venir a verlo?', '¿Cuánto tarda la obra?', '¿Dais garantía?', '¿Os encargáis de los permisos?'],
    ideas: {
      ventas: ['Un presupuesto sin seguimiento es un presupuesto perdido: llama a los 3 días.', 'Visita en 48 h: quien llega primero suele cerrar.'],
      atencion: ['Informa del avance de la obra cada semana con una foto.', 'Deja por escrito plazos y forma de pago.'],
      fidelizacion: ['Pide reseña con fotos del antes y el después.', 'Ofrece revisión o mantenimiento al año.'],
    },
  },
  formacion: {
    nombre: 'Academia y formación', cliente: 'alumno', clientes: 'alumnos', ciclo: 120,
    etapas: [E('nuevo', 'Interesado', '#20B8FF'), E('prueba', 'Clase de prueba', '#4285F4'), E('matricula', 'Matrícula pendiente', '#9B7BDB'), ...CIERRE],
    faq: ['¿Cuándo empieza el próximo curso?', '¿Cuánto cuesta?', '¿Hay clase de prueba?', '¿Es presencial u online?', '¿Dais certificado?'],
    ideas: {
      ventas: ['Ofrece una clase de prueba y haz seguimiento ese mismo día.', 'Recuerda la fecha límite de matrícula: crea urgencia real.'],
      atencion: ['Responde dudas de horarios y precios al momento.', 'Avisa de cambios de clase con antelación.'],
      fidelizacion: ['Propón el siguiente nivel al acabar un curso.', 'Pide testimonios a los alumnos que terminan.'],
    },
  },
  fitness: {
    nombre: 'Gimnasio, deporte y bienestar', cliente: 'socio', clientes: 'socios', ciclo: 30,
    faq: ['¿Cuánto cuesta la cuota?', '¿Tenéis matrícula?', '¿Hay clase de prueba?', '¿Cuál es el horario?', '¿Cómo me doy de baja?'],
    ideas: {
      ventas: ['Invita a una clase de prueba y llama al día siguiente.', 'Promociones sin matrícula en enero y septiembre.'],
      atencion: ['Responde rápido las dudas de horarios y bajas.', 'Recoge quejas de instalaciones y contesta con la solución.'],
      fidelizacion: ['Quien deja de venir 2 semanas está a punto de darse de baja: escríbele.', 'Celebra los hitos (3 meses, 1 año) del socio.'],
    },
  },
};

export async function sectorActual() {
  const id = (await db.ajuste('sectorId')) || 'general';
  return { id, ...(SECTORES[id] || SECTORES.general) };
}
