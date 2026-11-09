import { describe, it, expect } from 'vitest';
import { validateCredentials } from './auth-service.js';
import { hashPassword, rawHashPassword, formatShortName } from '../../utils.js';

describe('Módulo de Autenticação (Auth Module)', () => {
    // Hash puro da senha 134679
    const MAYCON_RAW_HASH = 'c4e4866953bba378413a4558ee984a68ad52e4ce2fa039d4966182fefa632901';
    
    // Hash salgado da senha 123456
    const DEFAULT_SALTED_HASH = 'ba07bead0aca371cf4d3a615da233173d237b5025132a96821bfc5aa4eb896c6';

    const mockUsers = [
        {
            id: 1,
            name: 'MAYCON DIAS',
            email: 'maycon@cranepro.com',
            password: MAYCON_RAW_HASH,
            permission: 'ADMINISTRADOR',
            cargo: 'GERENTE'
        },
        {
            id: 2,
            name: 'PEDRO ALMEIDA',
            email: 'pedro@cranepro.com',
            password: DEFAULT_SALTED_HASH,
            permission: 'TECNICO',
            cargo: 'INSPETOR'
        },
        {
            id: 3,
            name: 'Administrador',
            email: 'admin@tecnocrane.com.br',
            password: '123',
            permission: 'ADMIN',
            cargo: 'GESTOR'
        }
    ];

    it('Deve autenticar usuário com senha em formato de hash legado (ex: Maycon 134679)', async () => {
        const result = await validateCredentials(mockUsers, 'maycon@cranepro.com', '134679');
        expect(result).not.toBeNull();
        expect(result.user).toBeDefined();
        expect(result.user.email).toBe('maycon@cranepro.com');
        expect(result.user.name).toBe('MAYCON DIAS');
        expect(result.needsUpgrade).toBe(true); // Indica que deve migrar para hash salgado
    });

    it('Deve autenticar usuário com senha em formato salgado padrão (ex: Pedro 123456)', async () => {
        const result = await validateCredentials(mockUsers, 'pedro@cranepro.com', '123456');
        expect(result).not.toBeNull();
        expect(result.user).toBeDefined();
        expect(result.user.email).toBe('pedro@cranepro.com');
        expect(result.user.name).toBe('PEDRO ALMEIDA');
        expect(result.needsUpgrade).toBe(false);
    });

    it('Deve autenticar usuário com senha em texto plano (fallback de testes)', async () => {
        const result = await validateCredentials(mockUsers, 'admin@tecnocrane.com.br', '123');
        expect(result).not.toBeNull();
        expect(result.user.email).toBe('admin@tecnocrane.com.br');
        expect(result.user.permission).toBe('ADMIN');
    });

    it('Deve rejeitar o login com senha incorreta para qualquer usuário', async () => {
        const result = await validateCredentials(mockUsers, 'maycon@cranepro.com', 'senha_errada');
        expect(result).toBeNull();
    });

    it('Deve rejeitar o login com e-mail inexistente', async () => {
        const result = await validateCredentials(mockUsers, 'inexistente@cranepro.com', '123456');
        expect(result).toBeNull();
    });

    it('Deve rejeitar o login se e-mail ou senha estiverem vazios', async () => {
        expect(await validateCredentials(mockUsers, '', '123456')).toBeNull();
        expect(await validateCredentials(mockUsers, 'maycon@cranepro.com', '')).toBeNull();
    });

    it('Deve ignorar maiúsculas/minúsculas no e-mail', async () => {
        const result = await validateCredentials(mockUsers, 'MAYCON@CRANEPRO.COM', '134679');
        expect(result).not.toBeNull();
        expect(result.user.name).toBe('MAYCON DIAS');
    });

    it('Deve verificar se a estrutura de usuário logado é válida para persistência', () => {
        const validUser = { id: 1, name: 'MAYCON DIAS', email: 'maycon@cranepro.com', permission: 'ADMINISTRADOR' };
        expect(validUser.id).toBeDefined();
        expect(validUser.id).not.toBe('anon');
        expect(validUser.name).toBe('MAYCON DIAS');
    });

    describe('Formatação de Nomes com Preposições (formatShortName)', () => {
        it('Deve formatar nomes com preposição "da" sem cortar o sobrenome', () => {
            expect(formatShortName('JOSE DA SILVA')).toBe('JOSE DA SILVA');
            expect(formatShortName('APARECIDO DA SILVA')).toBe('APARECIDO DA SILVA');
        });

        it('Deve formatar nomes com preposição "de", "do", "dos", "das"', () => {
            expect(formatShortName('MARIA DE SOUZA')).toBe('MARIA DE SOUZA');
            expect(formatShortName('JOAO DO NASCIMENTO')).toBe('JOAO DO NASCIMENTO');
            expect(formatShortName('LUCAS DOS SANTOS')).toBe('LUCAS DOS SANTOS');
            expect(formatShortName('ANA DAS DORES')).toBe('ANA DAS DORES');
        });

        it('Deve formatar nomes sem preposição normalmente', () => {
            expect(formatShortName('MAYCON DIAS')).toBe('MAYCON DIAS');
            expect(formatShortName('JOSE SANTOS')).toBe('JOSE SANTOS');
            expect(formatShortName('CARLOS')).toBe('CARLOS');
        });
    });
});
