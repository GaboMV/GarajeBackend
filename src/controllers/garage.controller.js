const prisma = require('../db/prisma');
const { uploadFilePublic, uploadFilePrivate, getDynamicPresignedUrl } = require('../services/upload.service');

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

        // Validar propiedad
        const garaje = await prisma.garaje.findUnique({ where: { id: idGaraje } });
        if (!garaje || garaje.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'No tienes permisos sobre este garaje' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No se envió ninguna imagen' });
        }

        // Subimos a R2 en la carpeta 'garajes'
        const url = await uploadFilePublic(req.file, 'garajes');

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

/**
 * 6. Get Garages for the logged-in User
 * Listar los garajes que pertenecen al usuario (Mis Garajes)
 */
const getMyGarages = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const garajes = await prisma.garaje.findMany({
            where: { id_dueno },
            include: {
                imagenes: true,
                horarios_semanales: true
            }
        });
        res.json({ garajes });
    } catch (error) {
        next(error);
    }
}

/**
 * 7. Get Garage By Id
 * Ver el detalle completo de un garaje
 */
const getGarageById = async (req, res, next) => {
    try {
        const { idGaraje } = req.params;
        const garaje = await prisma.garaje.findUnique({
            where: { id: idGaraje },
            include: {
                imagenes: true,
                horarios_semanales: true,
                servicios_adicionales: true,
                fechas_bloqueadas: true,
                dueno: {
                    select: {
                        nombre_completo: true,
                        url_foto_perfil: true
                    }
                }
            }
        });

        if (!garaje) {
            return res.status(404).json({ error: 'Garaje no encontrado' });
        }

        res.json({ garaje });
    } catch (error) {
        next(error);
    }
}

/**
 * 8. Update Garage Details
 * Editar información de un garaje existente
 */
const updateGarage = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const { idGaraje } = req.params;
        const {
            nombre, descripcion, direccion,
            latitud, longitud, precio_hora, precio_dia,
            minimo_horas, tiempo_limpieza, capacidad_puestos,
            tiene_wifi, tiene_bano, tiene_electricidad, tiene_mesa
        } = req.body;

        const garajeExistente = await prisma.garaje.findUnique({ where: { id: idGaraje } });
        if (!garajeExistente || garajeExistente.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'No tienes permisos para editar este garaje' });
        }

        const garajeActualizado = await prisma.garaje.update({
            where: { id: idGaraje },
            data: {
                nombre: nombre !== undefined ? nombre : garajeExistente.nombre,
                descripcion: descripcion !== undefined ? descripcion : garajeExistente.descripcion,
                direccion: direccion !== undefined ? direccion : garajeExistente.direccion,
                latitud: latitud !== undefined ? latitud : garajeExistente.latitud,
                longitud: longitud !== undefined ? longitud : garajeExistente.longitud,
                precio_hora: precio_hora !== undefined ? precio_hora : garajeExistente.precio_hora,
                precio_dia: precio_dia !== undefined ? precio_dia : garajeExistente.precio_dia,
                minimo_horas: minimo_horas !== undefined ? minimo_horas : garajeExistente.minimo_horas,
                tiempo_limpieza: tiempo_limpieza !== undefined ? tiempo_limpieza : garajeExistente.tiempo_limpieza,
                capacidad_puestos: capacidad_puestos !== undefined ? capacidad_puestos : garajeExistente.capacidad_puestos,
                tiene_wifi: tiene_wifi !== undefined ? tiene_wifi : garajeExistente.tiene_wifi,
                tiene_bano: tiene_bano !== undefined ? tiene_bano : garajeExistente.tiene_bano,
                tiene_electricidad: tiene_electricidad !== undefined ? tiene_electricidad : garajeExistente.tiene_electricidad,
                tiene_mesa: tiene_mesa !== undefined ? tiene_mesa : garajeExistente.tiene_mesa,
            }
        });

        res.json({ message: 'Garaje actualizado exitosamente', garaje: garajeActualizado });
    } catch (error) {
        next(error);
    }
}

/**
 * Admin: List pending garages
 */
const getPendingGarages = async (req, res, next) => {
    try {
        const garages = await prisma.garaje.findMany({
            where: { esta_aprobado: false },
            include: {
                dueno: { select: { nombre_completo: true, correo: true } },
                imagenes: true
            }
        });

        // Generar URLs temporales para los documentos de propiedad
        const garagesWithUrls = await Promise.all(garages.map(async (g) => {
            const docUrl = g.documento_propiedad_url 
                ? await getDynamicPresignedUrl(g.documento_propiedad_url)
                : null;
            return { ...g, documento_propiedad_presigned: docUrl };
        }));

        res.json({ count: garagesWithUrls.length, garages: garagesWithUrls });
    } catch (error) {
        next(error);
    }
}

/**
 * Admin: Approve Garage
 */
const approveGarage = async (req, res, next) => {
    try {
        const { idGaraje } = req.params;
        const garage = await prisma.garaje.update({
            where: { id: idGaraje },
            data: { esta_aprobado: true }
        });
        res.json({ message: 'Garaje aprobado exitosamente', garage });
    } catch (error) {
        next(error);
    }
}

/**
 * 8. Subir Documento de Propiedad (Bucket PRIVADO)
 */
const uploadPropertyDoc = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const { idGaraje } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }

        const garaje = await prisma.garaje.findUnique({ where: { id: idGaraje } });
        if (!garaje || garaje.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'No tienes permisos sobre este garaje' });
        }

        // Subir al bucket PRIVADO (igual que el KYC) y guardar solo la KEY
        const key = await uploadFilePrivate(req.file, 'garajes-docs');

        await prisma.garaje.update({
            where: { id: idGaraje },
            data: { documento_propiedad_url: key }
        });

        res.json({ message: 'Documento de propiedad subido con éxito. El admin lo revisará.', key });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createGaraje,
    addHorario,
    addServicioAdicional,
    blockDate,
    addImagen,
    getMyGarages,
    getGarageById,
    updateGarage,
    getPendingGarages,
    approveGarage,
    uploadPropertyDoc
};
