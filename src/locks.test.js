import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { acquireLock, releaseLock, getCurrentUser, setCurrentUser, releaseAllLocks } from './locks.js';

describe('Concurrency Lock System (src/locks.js)', () => {
    beforeEach(() => {
        setCurrentUser({ id: 'u1', name: 'MAYCON DIAS', email: 'maycon@test.com' });
    });

    afterEach(async () => {
        await releaseAllLocks();
    });

    it('deve armazenar e retornar o usuário logado atual', () => {
        const user = getCurrentUser();
        expect(user.name).toBe('MAYCON DIAS');
        expect(user.email).toBe('maycon@test.com');
    });

    it('deve adquirir a trava com sucesso para um novo recurso', async () => {
        const res = await acquireLock('test_resource_1');
        expect(res.success).toBe(true);
    });

    it('deve bloquear aquisição se outro usuário mantiver a trava ativa', async () => {
        // Usuário 1 adquire a trava
        setCurrentUser({ id: 'u1', name: 'MAYCON DIAS', email: 'maycon@test.com' });
        await acquireLock('shared_resource');

        // Usuário 2 tenta adquirir a mesma trava
        setCurrentUser({ id: 'u2', name: 'JOAO SILVA', email: 'joao@test.com' });
        const res = await acquireLock('shared_resource');
        expect(res.success).toBe(false);
        expect(res.lockedBy).toBe('MAYCON DIAS');
    });

    it('deve liberar a trava e permitir aquisição por outro usuário', async () => {
        // Usuário 1 adquire e libera a trava
        setCurrentUser({ id: 'u1', name: 'MAYCON DIAS', email: 'maycon@test.com' });
        await acquireLock('released_resource');
        await releaseLock('released_resource');

        // Usuário 2 tenta adquirir a trava liberada
        setCurrentUser({ id: 'u2', name: 'JOAO SILVA', email: 'joao@test.com' });
        const res = await acquireLock('released_resource');
        expect(res.success).toBe(true);
    });
});
