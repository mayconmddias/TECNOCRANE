import { describe, it, expect } from 'vitest';
import { hashPassword } from '../../utils.js';

// Função de validação isolada do módulo de autenticação
export async function validateCredentials(candidateUsers, email, pass) {
    if (!email || !pass) return null;
    const normalizedEmail = email.trim().toLowerCase();
    const passHash = await hashPassword(pass.trim());

    for (const u of candidateUsers) {
        const uEmail = (u.email || '').trim().toLowerCase();
        if (uEmail === normalizedEmail) {
            const uPass = u.password || '';
            const uHash = await hashPassword(uPass);
            if (uPass === pass || uPass === passHash || uHash === passHash) {
                return {
                    id: u.id,
                    name: (u.name || '').toUpperCase(),
                    cargo: (u.cargo || u.role || 'TÉCNICO').toUpperCase(),
                    email: uEmail,
                    permission: u.permission || 'TECNICO',
                    signature: u.signature || u.assinatura || ''
                };
            }
        }
    }
    return null;
}

describe('Módulo de Autenticação (Auth Module)', () => {
    const mockUsers = [
        {
            id: '1',
            name: 'Administrador',
            email: 'admin@tecnocrane.com.br',
            password: '123',
            permission: 'ADMIN',
            cargo: 'GESTOR'
        },
        {
            id: '2',
            name: 'Técnico Teste',
            email: 'tecnico@tecnocrane.com.br',
            password: '456',
            permission: 'TECNICO',
            cargo: 'INSPETOR'
        }
    ];

    it('Deve autenticar o usuário com credenciais corretas', async () => {
        const user = await validateCredentials(mockUsers, 'admin@tecnocrane.com.br', '123');
        expect(user).not.toBeNull();
        expect(user.email).toBe('admin@tecnocrane.com.br');
        expect(user.permission).toBe('ADMIN');
    });

    it('Deve rejeitar o login com senha incorreta', async () => {
        const user = await validateCredentials(mockUsers, 'admin@tecnocrane.com.br', 'senha_errada');
        expect(user).toBeNull();
    });

    it('Deve rejeitar o login com e-mail inexistente', async () => {
        const user = await validateCredentials(mockUsers, 'inexistente@tecnocrane.com.br', '123');
        expect(user).toBeNull();
    });

    it('Deve ignorar maiúsculas/minúsculas no e-mail', async () => {
        const user = await validateCredentials(mockUsers, 'ADMIN@TECNOCRANE.COM.BR', '123');
        expect(user).not.toBeNull();
        expect(user.name).toBe('ADMINISTRADOR');
    });
});
