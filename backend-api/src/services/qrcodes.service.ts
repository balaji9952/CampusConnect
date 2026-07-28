import prisma from '../utils/prisma';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';

export class QrcodesService {
  static async create(data: {
    qrNumber: string;
    location: string;
    block: string;
    floor: string;
    qrValue: string;
    pngPath: string;
    pdfPath: string;
    internalCode: string;
    category: string;
    department: string;
    routingType: string;
    status: string;
    qrImageBase64: string;
  }) {
    // 1. Insert/Upsert into QR_MASTER
    const qrRecord = await prisma.qR_MASTER.upsert({
      where: { QrNumber: data.qrNumber },
      update: {
        Location: data.location,
        Block: data.block,
        Floor: data.floor,
        QrValue: data.qrValue,
        PngPath: data.pngPath,
        PdfPath: data.pdfPath,
        UpdatedDate: new Date(),
        Status: data.status,
        QrImageBase64: data.qrImageBase64 || null
      },
      create: {
        QrNumber: data.qrNumber,
        Location: data.location,
        Block: data.block,
        Floor: data.floor,
        QrValue: data.qrValue,
        PngPath: data.pngPath,
        PdfPath: data.pdfPath,
        Status: data.status,
        QrImageBase64: data.qrImageBase64 || null
      }
    });

    // 2. Resolve department_id if possible
    let deptId: number | null = null;
    if (data.department && data.department !== 'No Department') {
      const dept = await prisma.departments.findFirst({
        where: { name: { contains: data.department, mode: 'insensitive' } }
      });
      if (dept) deptId = dept.id;
    }

    // 3. Link/create location in locations table
    const locationName = data.block && data.floor 
      ? `${data.location} (${data.block}, ${data.floor})`
      : data.location;

    let dbLocation = await prisma.locations.findUnique({
      where: { name: locationName }
    });

    if (!dbLocation) {
      dbLocation = await prisma.locations.create({
        data: {
          name: locationName,
          block: data.block || null,
          floor: data.floor || null,
          is_active: data.status === 'Active',
          category_id: 1, // Legacy fallback
          routing_group_id: null,
          internal_code: data.internalCode || null,
          department_id: deptId
        }
      });
    } else {
      dbLocation = await prisma.locations.update({
        where: { id: dbLocation.id },
        data: {
          block: data.block || null,
          floor: data.floor || null,
          is_active: data.status === 'Active',
          category_id: data.category ? parseInt(data.category, 10) : 1,
          internal_code: data.internalCode || null,
          department_id: deptId
        }
      });
    }

    // 4. Save or generate the QR image file locally
    let qrImageUrl = `/uploads/qrcodes/${data.qrNumber}.png`;

    try {
      const uploadDir = path.join(__dirname, '../../uploads/qrcodes');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filePath = path.join(uploadDir, `${data.qrNumber}.png`);

      if (data.qrImageBase64) {
        const buffer = Buffer.from(data.qrImageBase64, 'base64');
        fs.writeFileSync(filePath, buffer);
      } else {
        await QRCode.toFile(filePath, data.qrValue, {
          width: 300,
          margin: 2
        });
      }
    } catch (err) {
      console.error('Failed to save or generate local QR image file:', err);
      qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.qrValue)}`;
    }

    // 5. Create/Upsert in qr_codes table to link with locations
    await prisma.qr_codes.upsert({
      where: { qr_token: data.qrNumber },
      update: {
        location_id: dbLocation.id,
        qr_image_url: qrImageUrl,
        qr_image_base64: data.qrImageBase64 || null,
        is_active: data.status === 'Active',
      },
      create: {
        location_id: dbLocation.id,
        qr_token: data.qrNumber,
        qr_image_url: qrImageUrl,
        qr_image_base64: data.qrImageBase64 || null,
        is_active: data.status === 'Active',
      }
    });

    return qrRecord;
  }

  static async list(search?: string, status?: string) {
    const where: any = {};
    if (status) {
      where.Status = status;
    }
    if (search) {
      where.OR = [
        { QrNumber: { contains: search } },
        { Location: { contains: search } },
        { Block: { contains: search } },
        { Floor: { contains: search } }
      ];
    }
    return prisma.qR_MASTER.findMany({
      where,
      orderBy: { CreatedDate: 'desc' }
    });
  }

  static async getById(id: number) {
    return prisma.qR_MASTER.findUnique({
      where: { Id: id }
    });
  }

  static async getByQrNumber(qrNumber: string) {
    return prisma.qR_MASTER.findUnique({
      where: { QrNumber: qrNumber }
    });
  }

  static async update(id: number, data: {
    location?: string;
    block?: string;
    floor?: string;
    status?: string;
  }) {
    const updateData: any = {
      UpdatedDate: new Date()
    };
    if (data.location !== undefined) updateData.Location = data.location;
    if (data.block !== undefined) updateData.Block = data.block;
    if (data.floor !== undefined) updateData.Floor = data.floor;
    if (data.status !== undefined) updateData.Status = data.status;

    // Update in QR_MASTER
    const qrRecord = await prisma.qR_MASTER.update({
      where: { Id: id },
      data: updateData
    });

    // Also sync the location details if they changed
    const locationName = qrRecord.Block && qrRecord.Floor 
      ? `${qrRecord.Location} (${qrRecord.Block}, ${qrRecord.Floor})`
      : qrRecord.Location;

    let dbLocation = await prisma.locations.findUnique({
      where: { name: locationName }
    });
    
    if (dbLocation) {
      await prisma.locations.update({
        where: { id: dbLocation.id },
        data: {
          block: qrRecord.Block || null,
          floor: qrRecord.Floor || null,
          is_active: qrRecord.Status === 'Active'
        }
      });
    }

    return qrRecord;
  }

  static async delete(id: number) {
    const qr = await prisma.qR_MASTER.findUnique({ where: { Id: id } });
    if (!qr) return null;

    // Delete from QR_MASTER
    await prisma.qR_MASTER.delete({
      where: { Id: id }
    });

    const locationName = qr.Block && qr.Floor 
      ? `${qr.Location} (${qr.Block}, ${qr.Floor})`
      : qr.Location;

    const dbLocation = await prisma.locations.findUnique({
      where: { name: locationName }
    });

    if (dbLocation) {
      await prisma.locations.update({
        where: { id: dbLocation.id },
        data: { is_active: false }
      });
    }

    return qr;
  }
}
