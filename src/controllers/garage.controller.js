const prisma = require('../db/prisma');

/**
 * 1. Crear un nuevo Garaje
 * El dueño sube su garaje, establece la ubicación, precios y reglas.
 */
const createGaraje = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const {
            nombre, descripcion, direccion,
            latitud, longitud, precio_hora, precio_dia,
            minimo_horas, tiempo_limpieza,
            tiene_wifi, tiene_bano, tiene_electricidad, tiene_mesa
        } = req.body;

        if (!nombre || (!precio_hora && !precio_dia)) {
            return res.status(400).json({ error: 'Nombre y al menos un precio (hora o dia) son obligatorios' });
        }

        const nuevoGaraje = await prisma.garaje.create({
            data: {
                id_dueno,
                nombre,
                descripcion,
                direccion,
                latitud,
                longitud,
                precio_hora,
                precio_dia,
                minimo_horas: minimo_horas || 1,
                tiempo_limpieza: tiempo_limpieza || 0,
                tiene_wifi: tiene_wifi || false,
                tiene_bano: tiene_bano || false,
                tiene_electricidad: tiene_electricidad || false,
                tiene_mesa: tiene_mesa || false,
            }
        });

        res.status(201).json({
            message: 'Garaje creado exitosamente',
            garaje: nuevoGaraje
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 2. Agregar un Horario Semanal
 * El Dueño define qué días y horas está abierto.
 */
const addHorario = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const { idGaraje } = req.params;
        const { dia_semana, abierto, hora_inicio, hora_fin } = req.body;

        // Validar propiedad del garaje
        const garaje = await prisma.garaje.findUnique({ where: { id: idGaraje } });
        if (!garaje || garaje.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'No tienes permisos sobre este garaje' });
        }

        const horario = await prisma.horarioSemanal.create({
            data: {
                id_garaje: idGaraje,
                dia_semana,       // 0=Dom, 1=Lun...
                abierto: abierto !== undefined ? abierto : true,
                hora_inicio: hora_inicio || "08:00",
                hora_fin: hora_fin || "20:00"
            }
        });

        res.status(201).json({
            message: 'Horario agregado',
            horario
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 3. Agregar un Servicio Adicional (Upselling)
 * Ej: "Toldo por 20 Bs/dia".
 */
const addServicioAdicional = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const { idGaraje } = req.params;
        const { nombre, precio, es_por_dia } = req.body;

        // Validar propiedad
        const garaje = await prisma.garaje.findUnique({ where: { id: idGaraje } });
        if (!garaje || garaje.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'No tienes permisos sobre este garaje' });
        }

        const servicio = await prisma.servicioAdicional.create({
            data: {
                id_garaje: idGaraje,
                nombre,
                precio,
                es_por_dia: es_por_dia !== undefined ? es_por_dia : true,
            }
        });

        res.status(201).json({
            message: 'Servicio extra agregado',
            servicio
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 4. Bloquear una Fecha Específica
 * El dueño puede bloquear porque se va de viaje o por mantenimiento.
 */
const blockDate = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const { idGaraje } = req.params;
        const { fecha, motivo } = req.body; // fecha en formato YYYY-MM-DD

        // Validar propiedad
        const garaje = await prisma.garaje.findUnique({ where: { id: idGaraje } });
        if (!garaje || garaje.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'No tienes permisos sobre este garaje' });
        }

        const fechaBloqueada = await prisma.fechaBloqueada.create({
            data: {
                id_garaje: idGaraje,
                fecha: new Date(fecha),
                motivo
            }
        });

        res.status(201).json({
            message: 'Fecha bloqueada correctamente',
            fechaBloqueada
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 5. Subir fotos del garaje
 */
const addImagen = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const { idGaraje } = req.params;
        const { url } = req.body;

        // Validar propiedad
        const garaje = await prisma.garaje.findUnique({ where: { id: idGaraje } });
        if (!garaje || garaje.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'No tienes permisos sobre este garaje' });
        }

        const imagen = await prisma.imagenGaraje.create({
            data: {
                id_garaje: idGaraje,
                url
            }
        });

        res.status(201).json({ imagen });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createGaraje,
    addHorario,
    addServicioAdicional,
    blockDate,
    addImagen
};
