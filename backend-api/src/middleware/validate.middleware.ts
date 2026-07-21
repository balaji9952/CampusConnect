import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validateBody = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.body);
      Object.defineProperty(req, 'body', {
        value: parsed,
        writable: true,
        enumerable: true,
        configurable: true
      });
      next();
    } catch (error: any) {
      console.error('VALIDATE BODY ERROR:', error);
      if (error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: (error as any).errors
        });
        return;
      }
      res.status(500).json({ message: 'Internal server error', success: false });
    }
  };
};

export const validateQuery = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.query);
      Object.defineProperty(req, 'query', {
        value: parsed,
        writable: true,
        enumerable: true,
        configurable: true
      });
      next();
    } catch (error: any) {
      console.error('VALIDATE QUERY ERROR:', error);
      if (error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: (error as any).errors
        });
        return;
      }
      res.status(500).json({ message: 'Internal server error', success: false });
    }
  };
};

export const validateParams = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.params);
      Object.defineProperty(req, 'params', {
        value: parsed,
        writable: true,
        enumerable: true,
        configurable: true
      });
      next();
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: (error as any).errors
        });
        return;
      }
      res.status(500).json({ message: 'Internal server error', success: false });
    }
  };
};
