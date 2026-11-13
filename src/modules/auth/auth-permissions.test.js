import { describe, it, expect } from 'vitest';
import {
    isCurrentUserAdmin,
    isCurrentUserTechnician,
    getReportEditDeadline,
    isReportWithinEditPeriod,
    isReportAuthor,
    canEditReport,
    canDeleteReport,
    canExtendReportEditPeriod,
    canManageOpenOrder,
    canReassignOpenOrder,
    canManageScheduling,
    canManageCompaniesAndAssets,
    canAccessTemplates,
    canAccessUsers
} from './auth-permissions.js';

describe('auth-permissions module (RBAC)', () => {
    const adminUser = { id: 'u1', name: 'Maycon Dias', permission: 'ADMINISTRADOR' };
    const techUser1 = { id: 'u2', name: 'Aparecido de Jesus', permission: 'TECNICO' };
    const techUser2 = { id: 'u3', name: 'Jose Santos', permission: 'TECNICO' };

    describe('isCurrentUserAdmin and isCurrentUserTechnician', () => {
        it('identifies administrator correctly', () => {
            expect(isCurrentUserAdmin(adminUser)).toBe(true);
            expect(isCurrentUserTechnician(adminUser)).toBe(false);

            expect(isCurrentUserAdmin({ role: 'admin' })).toBe(true);
            expect(isCurrentUserAdmin({ cargo: 'ADMINISTRADOR' })).toBe(true);
        });

        it('identifies technician correctly', () => {
            expect(isCurrentUserAdmin(techUser1)).toBe(false);
            expect(isCurrentUserTechnician(techUser1)).toBe(true);

            expect(isCurrentUserAdmin(null)).toBe(false);
            expect(isCurrentUserTechnician(null)).toBe(true);
        });
    });

    describe('Report permissions: edit, delete and 15-day expiry with +10 days extension', () => {
        it('calculates deadline 15 days from creation', () => {
            const report = {
                createdAt: '2026-11-01T10:00:00Z',
                tecnico: 'Aparecido de Jesus'
            };
            const deadline = getReportEditDeadline(report);
            expect(deadline).not.toBeNull();
            // Base: 2026-11-01 + 15 days = 2026-11-16
            expect(deadline.getFullYear()).toBe(2026);
            expect(deadline.getMonth()).toBe(10); // November is 10
            expect(deadline.getDate()).toBe(16);
        });

        it('adds extended days to deadline when extended_days is present', () => {
            const report = {
                createdAt: '2026-11-01T10:00:00Z',
                extended_days: 10,
                tecnico: 'Aparecido de Jesus'
            };
            const deadline = getReportEditDeadline(report);
            // 2026-11-01 + 15 + 10 = 2026-11-26
            expect(deadline.getDate()).toBe(26);
        });

        it('allows technician to edit their own report within 15 days', () => {
            const report = {
                createdAt: '2026-11-10T10:00:00Z',
                tecnico: 'Aparecido de Jesus'
            };
            const today = new Date('2026-11-13T10:00:00Z'); // 3 days after creation
            expect(canEditReport(report, techUser1, today)).toBe(true);
        });

        it('blocks technician from editing their report after 15 days without extension', () => {
            const report = {
                createdAt: '2026-10-20T10:00:00Z',
                tecnico: 'Aparecido de Jesus'
            };
            const today = new Date('2026-11-13T10:00:00Z'); // 24 days later
            expect(canEditReport(report, techUser1, today)).toBe(false);
        });

        it('unblocks technician when report edit deadline is extended by admin', () => {
            const report = {
                createdAt: '2026-10-20T10:00:00Z',
                extended_days: 10, // 15 + 10 = 25 days => up to 2026-11-14
                tecnico: 'Aparecido de Jesus'
            };
            const today = new Date('2026-11-13T10:00:00Z'); // within 25 days
            expect(canEditReport(report, techUser1, today)).toBe(true);
        });

        it('blocks technician from editing report created by another technician', () => {
            const report = {
                createdAt: '2026-11-10T10:00:00Z',
                tecnico: 'Jose Santos'
            };
            const today = new Date('2026-11-13T10:00:00Z');
            // techUser1 is "Aparecido de Jesus"
            expect(canEditReport(report, techUser1, today)).toBe(false);
            // techUser2 is "Jose Santos"
            expect(canEditReport(report, techUser2, today)).toBe(true);
        });

        it('allows administrator to edit any report anytime', () => {
            const oldReportFromOther = {
                createdAt: '2025-01-01T10:00:00Z',
                tecnico: 'Outro Tecnico'
            };
            const today = new Date('2026-11-13T10:00:00Z');
            expect(canEditReport(oldReportFromOther, adminUser, today)).toBe(true);
        });

        it('allows only administrator to delete reports', () => {
            expect(canDeleteReport(adminUser)).toBe(true);
            expect(canDeleteReport(techUser1)).toBe(false);
        });

        it('allows only administrator to extend report edit period', () => {
            expect(canExtendReportEditPeriod(adminUser)).toBe(true);
            expect(canExtendReportEditPeriod(techUser1)).toBe(false);
        });
    });

    describe('Open orders (OS) permissions: reassign, resume and delete', () => {
        it('allows admin to manage and reassign any open order', () => {
            const order = { id: 'os-1', tecnico: 'Jose Santos', assignedTo: 'Jose Santos' };
            expect(canManageOpenOrder(order, adminUser)).toBe(true);
            expect(canReassignOpenOrder(adminUser)).toBe(true);
        });

        it('allows technician to manage only order assigned to or created by him', () => {
            const orderMine = { id: 'os-1', tecnico: 'Aparecido de Jesus' };
            const orderAssigned = { id: 'os-2', tecnico: 'Outro', assignedTo: 'Aparecido de Jesus' };
            const orderOther = { id: 'os-3', tecnico: 'Jose Santos', assignedTo: 'Jose Santos' };

            expect(canManageOpenOrder(orderMine, techUser1)).toBe(true);
            expect(canManageOpenOrder(orderAssigned, techUser1)).toBe(true);
            expect(canManageOpenOrder(orderOther, techUser1)).toBe(false);

            expect(canReassignOpenOrder(techUser1)).toBe(false);
        });
    });

    describe('Section permissions: Programação, Empresas/Ativos, Formulários, Cadastro Interno', () => {
        it('verifies scheduling permissions', () => {
            expect(canManageScheduling(adminUser)).toBe(true);
            expect(canManageScheduling(techUser1)).toBe(false);
        });

        it('verifies companies and assets edit permissions', () => {
            expect(canManageCompaniesAndAssets(adminUser)).toBe(true);
            expect(canManageCompaniesAndAssets(techUser1)).toBe(false);
        });

        it('verifies templates and users navigation permissions', () => {
            expect(canAccessTemplates(adminUser)).toBe(true);
            expect(canAccessTemplates(techUser1)).toBe(false);

            expect(canAccessUsers(adminUser)).toBe(true);
            expect(canAccessUsers(techUser1)).toBe(false);
        });
    });
});

