// Crane Pro - Checklist Schema (árvore de inspeção técnica)

function inspectable(id, label) {
    return { id, label, fieldType: 'inspectable' };
}

function textField(id, label, hint = '') {
    return { id, label, fieldType: 'text', hint };
}

function textareaField(id, label, hint = '') {
    return { id, label, fieldType: 'textarea', hint };
}

function section(id, title, children, level = 2) {
    return { id, title, level, inspectable: false, children };
}

function mainSection(num, title, children) {
    return { id: String(num), title, level: 1, inspectable: false, children };
}

const CABLE_INSPECTION_FIELDS = (prefix) => [
    textField(`${prefix}.arames`, 'Arames rompidos'),
    textField(`${prefix}.bitola`, 'Bitola do Cabo'),
    textField(`${prefix}.diametro`, 'Diâmetro conforme catálogo de referência (Cimaf/similar)'),
    textField(`${prefix}.diametro_medido`, 'DIÂMETRO VALOR MEDIDO'),
    textField(`${prefix}.reducao`, 'Redução do diâmetro em porcentagem (7% máximo conforme norma)'),
    textField(`${prefix}.corrosao`, 'Corrosão Grau 1 = ok; 2 = leve; 3 = médio; 4 = alto; 5 = Substituição'),
    textField(`${prefix}.danos`, 'Deformação ou Danos Grau 1 = ok; 2 = leve; 3 = médio; 4 = alto; 5 = Substituição'),
    textField(`${prefix}.deterioracao`, 'Grau acumulativo de deterioração 1 = ok; 2 = leve; 3 = médio; 4 = alto; 5 = Substituição'),
    textareaField(`${prefix}.observacoes`, 'Observações'),
];

const BLOCK_INSPECTION_FIELDS = (prefix) => [
    textField(`${prefix}.abertura`, 'Abertura do Gancho'),
    textField(`${prefix}.penetrante`, 'Líquido Penetrante'),
    textField(`${prefix}.protecao`, 'Proteção de Partes Móveis'),
    textField(`${prefix}.din`, 'Gancho conforme DIN 15400'),
    textField(`${prefix}.capacidade`, 'Indicação de Capacidade'),
    textareaField(`${prefix}.observacoes`, 'Observações'),
];

function createElevationSection(num, title) {
    const p = String(num);
    const suffix = num === 5 ? 'Principal' : 'Auxiliar';
    return mainSection(num, title, [
        section(`${p}.1`, `${p}.1 Motores de Elevação ${suffix}`, [
            inspectable(`${p}.1.alinhamento`, 'Alinhamento e Fixação dos motores'),
            inspectable(`${p}.1.conexoes`, 'Fixação e reaperto conexões elétricas'),
            inspectable(`${p}.1.rolamentos`, 'Rolamentos'),
            inspectable(`${p}.1.limpeza`, 'Limpeza e ventilação'),
            ...(num === 5 ? [] : [inspectable(`${p}.1.isolamento`, 'Isolamento elétrico')]),
            inspectable(`${p}.1.vibracao`, 'Ausência vibração e ruído'),
        ]),
        section(`${p}.2`, `${p}.2 Freios da Elevação ${suffix}`, [
            inspectable(`${p}.2.desgaste`, 'Ausência de desgaste das lonas ou discos'),
            inspectable(`${p}.2.ajuste`, 'Ajuste do Freio (folga entre 0,4 a 0,6mm)'),
        ]),
        section(`${p}.3`, `${p}.3 Fins de Curso da Elevação ${suffix}`, [
            inspectable(`${p}.3.fixacao`, 'Fixação e reaperto dos fins de curso'),
            inspectable(`${p}.3.acionamento`, 'Acionamento dos Fins de curso (subida, descida, redundante da subida)'),
        ]),
        section(`${p}.4`, `${p}.4 Redutor da Elevação ${suffix}`, [
            inspectable(`${p}.4.alinhamento`, 'Alinhamento e Fixação'),
            inspectable(`${p}.4.oleo`, 'Nível de óleo'),
            inspectable(`${p}.4.vedacao`, 'Vedação ausência de vazamento'),
            inspectable(`${p}.4.engrenagens`, 'Engrenagens ausência de desgastes, trincas ou quebras'),
            inspectable(`${p}.4.eixos`, 'Eixos ausência de folga e desalinhamento (entrada e saída)'),
        ]),
        section(`${p}.5`, `${p}.5 Tambor do Cabo de Aço (Dromo) da elevação ${suffix}`, [
            inspectable(`${p}.5.ranhuras`, 'Ranhuras (passo) ausência de desgastes, trincas ou quebras'),
            inspectable(`${p}.5.voltas`, 'Voltas de reserva do cabo de aço'),
            inspectable(`${p}.5.enrolamento`, 'Alinhamento do enrolamento do cabo de aço'),
        ]),
        section(`${p}.6`, `${p}.6 Cabo de Aço de Elevação ${suffix} <br><span class="text-sm font-normal text-on-surface-variant block mt-1">Inspeção Técnica de acordo com a NBR ISO 4309 itens “3.4 Inspeção” e “3.5 Critérios de Descarte”</span>`, [
            inspectable(`${p}.6.fixacao`, 'Fixação e ancoragem do cabo de aço'),
            inspectable(`${p}.6.desgaste`, 'Ausência de desgaste dentro do limite aceitável pela norma NBR ISO 4309;'),
            inspectable(`${p}.6.esmagamento`, 'Ausência de esmagamento/engaiolamento'),
        ]),
        section(`${p}.6.1`, `${p}.6.1 Inspeção do Cabo de Aço da Elevação ${suffix}`,
            CABLE_INSPECTION_FIELDS(`${p}.6.1`),
            3
        ),
        section(`${p}.7`, `${p}.7 Conjunto de Caixa de Gancho (Moitão) Elevação ${suffix}`, [
            section(`${p}.7.1`, `${p}.7.1 Conjunto de Caixa de Gancho (Moitão) Elevação ${suffix}`, [
                inspectable(`${p}.7.1.abertura`, 'Abertura e torção frontal dentro do limite aceitável DIN 15405.'),
                inspectable(`${p}.7.1.roldanas`, 'Ausência de desgaste nas Roldanas com proteção de partes móveis'),
                inspectable(`${p}.7.1.trincas`, 'Ausência de trincas e fissuras'),
                inspectable(`${p}.7.1.desgastes_canal`, 'Ausência de desgastes no canal da polia'),
                inspectable(`${p}.7.1.rolamentos`, 'Rolamentos da polia ausência de folgas, ruídos e a rotação está livre'),
                inspectable(`${p}.7.1.mancal`, 'Mancal giratório lubrificação e rotação'),
                inspectable(`${p}.7.1.trava`, 'Trava de segurança'),
            ], 3),
            section(`${p}.7.2`, `${p}.7.2 Inspeção Conjunto de ${num === 5 ? '(Moitão)' : 'Moitão'} Elevação ${suffix}${num === 5 ? '' : '.'}`,
                BLOCK_INSPECTION_FIELDS(`${p}.7.2`),
                3
            )
        ]),
        section(`${p}.8`, `${p}.8 Conjunto de Caixa de Gancho (Bloco Superior) Elevação ${suffix}`, [
            inspectable(`${p}.8.polias`, 'Polias e Roldanas ausência de desgaste, trincas e quebras nos canais'),
            inspectable(`${p}.8.rolamentos`, 'Ausência de desgaste nos rolamentos'),
            inspectable(`${p}.8.mancais`, 'Eixo e Mancais ausência de folgas excessivas'),
            inspectable(`${p}.8.vedacoes`, 'Ausência de vazamento nas vedações'),
            inspectable(`${p}.8.pinos`, 'Ausência de desgaste nos pinos de articulação'),
            inspectable(`${p}.8.lubrificacao`, 'Lubrificação dos rolamentos'),
            inspectable(`${p}.8.fixacao`, 'Fixação e aperto geral de parafusos e porcas de sustentação do bloco e olhais estruturais'),
        ]),
    ]);
}

export const CHECKLIST_SCHEMA = [
    mainSection(1, '1 Sistema de Alimentação da Ponte Rolante.', [
        inspectable('1.alinhamento', 'Alinhamento'),
        inspectable('1.nivelamento', 'Nivelamento'),
        inspectable('1.carros', 'Carros Coletores'),
    ]),
    mainSection(2, '2 Sistema de Controle da Ponte Rolante', [
        inspectable('2.radio', 'Comunicação Rádio controle (transmissor e receptor)'),
        inspectable('2.botoeira', 'Funcionalidade dos botões ou no sistema reserva (botoeira).'),
    ]),
    mainSection(3, '3 Painel Elétrico Principal', [
        inspectable('3.fixacao', 'Fixação e reaperto dos componentes (bornes, disjuntores, contatores)'),
        inspectable('3.tensao_entrada', 'Tensão de entrada'),
        inspectable('3.tensao_comando', 'Tensão de comando'),
    ]),
    mainSection(4, '4 Painel Elétrico da Talha', [
        inspectable('4.fixacao', 'Fixação e reaperto dos componentes (bornes, disjuntores, contatores)'),
        inspectable('4.tensao_entrada', 'Tensão de entrada'),
    ]),
    createElevationSection(5, '5 – Sistema de Elevação Principal'),
    createElevationSection(6, '6 Sistema de Elevação Auxiliar'),
    mainSection(7, '7 Sistema de Translação do Carro', [
        section('7.1', '7.1 Motores de Translação do Carro', [
            inspectable('7.1.motores_alinhamento', 'Alinhamento e Fixação dos motores'),
            inspectable('7.1.motores_conexoes', 'Fixação e reaperto conexões elétricas'),
            inspectable('7.1.motores_rolamentos', 'Rolamentos'),
            inspectable('7.1.motores_limpeza', 'Limpeza e ventilação'),
            inspectable('7.1.motores_isolamento', 'Isolamento elétrico'),
            inspectable('7.1.motores_vibracao', 'Ausência vibração e ruído'),
        ]),
        section('7.2', '7.2 Freios da Translação do Carro', [
            inspectable('7.2.freios_desgaste', 'Ausência de desgaste das lonas ou discos'),
            inspectable('7.2.freios_ajuste', 'Ajuste do Freio (folga entre 0,4 a 0,6mm)'),
        ]),
        section('7.3', '7.3 Fins de Curso da Translação do Carro', [
            inspectable('7.3.fins_fixacao', 'Fixação e reaperto dos fins de curso'),
            inspectable('7.3.fins_acionamento', 'Acionamento dos Fins de curso (subida, descida, redundante da subida)'),
        ]),
        section('7.4', '7.4 Redutores da Translação do Carro', [
            inspectable('7.4.redutores_alinhamento', 'Alinhamento e Fixação'),
            inspectable('7.4.redutores_oleo', 'Nível de óleo'),
            inspectable('7.4.redutores_vedacao', 'Vedação ausência de vazamento'),
            inspectable('7.4.redutores_engrenagens', 'Engrenagens ausência de desgastes, trincas ou quebras'),
            inspectable('7.4.redutores_eixos', 'Eixos ausência de folga e desalinhamento (entrada e saída)'),
        ]),
        section('7.5', '7.5 Conjunto de Rodas da Translação do Carro', [
            inspectable('7.5.rodas_desgaste', 'Ausência de desgastes, trincas e quebras da pista de rolamento e franges'),
            inspectable('7.5.rodas_folga', 'Ausência de folga Roda-Trilho (aceitável folga lateral até 3mm de cada lado)'),
            inspectable('7.5.rodas_trilhos', 'Trilhos ausência de desgaste, trincas, quebras, desalinhamento ou fixação solta'),
        ]),
        section('7.6', '7.6 Caminho de Rolamento de Translação do Carro', [
            inspectable('7.6.caminho_trilhos', 'Trilhos ausência de desgaste, trincas, quebras, desalinhamento ou fixação solta'),
            inspectable('7.6.caminho_soldas', 'Soldas e emendas ausência trincas, quebras'),
            inspectable('7.6.caminho_nivelamento', 'Nivelamento das vigas ausência de deformação ou empenamento'),
        ]),
        section('7.7', '7.7 Sistema Festoon (Cortina de cabos) do Carro', [
            section('7.7.1', '7.7.1 Cabos e Conexões elétricas', [
                inspectable('7.6.1.cabos_isolamento', 'Ausência de cortes, esmagamentos ou ressecamento do isolamento do cabo.'),
                inspectable('7.6.1.cabos_conexoes', 'Fixação e reaperto conexões elétricas'),
                inspectable('7.6.1.cabos_arraste', 'Cabos de arraste/tração (quando presentes) ausência de rupturas, desgastes'),
            ], 3),
            section('7.7.2', '7.7.2 Carrinhos Porta-Cabos (Troles)', [
                inspectable('7.6.2.troles_movimento', 'Troles porta cabo movimento sem travamentos ou trancos'),
                inspectable('7.6.2.troles_rodizios', 'Rodízios e rolamentos ausência de desgastes ou travamentos'),
                inspectable('7.6.2.troles_fixacao', 'Fixação dos cabos abraçadeiras e suportes'),
            ], 3),
            section('7.7.3', '7.7.3 Trilhos e Estrutura de Suporte:', [
                inspectable('7.6.3.trilhos_alinhamento', 'Alinhamento e fixação do perfilado ou calha onde os carrinhos correm'),
                inspectable('7.6.3.trilhos_desgaste', 'Ausência de desgaste, trincas ou quebra'),
            ], 3),
            section('7.7.4', '7.7.4 Loops (curvas) dos cabos', [
                inspectable('7.6.4.loops_curvas', 'Curvas dos cabos nem muito esticadas ou muito longas'),
            ], 3),
        ]),
    ]),
    mainSection(8, '8 Sistema de Translação da Ponte Rolante', [
        section('8.1', '8.1 Motores de Translação da Ponte Rolante', [
            inspectable('8.1.motores_alinhamento', 'Alinhamento e Fixação dos motores'),
            inspectable('8.1.motores_conexoes', 'Fixação e reaperto conexões elétricas'),
            inspectable('8.1.motores_rolamentos', 'Rolamentos'),
            inspectable('8.1.motores_limpeza', 'Limpeza e ventilação'),
            inspectable('8.1.motores_isolamento', 'Isolamento elétrico'),
            inspectable('8.1.motores_vibracao', 'Ausência vibração e ruído'),
        ]),
        section('8.2', '8.2 Freios da Translação da Ponte Rolante', [
            inspectable('8.2.freios_desgaste', 'Ausência de desgaste das lonas ou discos'),
            inspectable('8.2.freios_ajuste', 'Ajuste do Freio (folga entre 0,4 a 0,6mm)'),
        ]),
        section('8.3', '8.3 Sensores Anticolisão da Translação da Ponte Rolante', [
            inspectable('8.3.sensores_fixacao', 'Fixação e reaperto dos sensores'),
            inspectable('8.3.sensores_acionamento', 'Acionamento dos sensores'),
        ]),
        section('8.4', '8.4 Redutores da Translação da Ponte Rolante', [
            inspectable('8.4.redutores_alinhamento', 'Alinhamento e Fixação'),
            inspectable('8.4.redutores_oleo', 'Nível de óleo'),
            inspectable('8.4.redutores_vedacao', 'Vedação ausência de vazamento'),
            inspectable('8.4.redutores_engrenagens', 'Engrenagens ausência de desgastes, trincas ou quebras'),
            inspectable('8.4.redutores_eixos', 'Eixos ausência de folga e desalinhamento (entrada e saída)'),
        ]),
        section('8.5', '8.5 Conjunto de Rodas da Translação da Ponte Rolante', [
            inspectable('8.5.rodas_desgaste', 'Ausência de desgastes, trincas e quebras da pista de rolamento e franges'),
            inspectable('8.5.rodas_folga', 'Ausência de folga Roda-Trilho (aceitável folga lateral até 3mm de cada lado)'),
        ]),
        section('8.6', '8.6 Caminho de Rolamento', [
            inspectable('8.6.caminho_trilhos', 'Trilhos ausência de desgaste, trincas, quebras, desalinhamento ou fixação solta'),
            inspectable('8.6.caminho_soldas', 'Soldas e emendas ausência trincas, quebras'),
            inspectable('8.6.caminho_nivelamento', 'Nivelamento das vigas ausência de deformação ou empenamento'),
        ]),
        section('8.7', '8.7 Estrutura do Equipamento (Junções vigas, Cabeceira e Carro Talha)', [
            section('8.7.1', '8.7.1 Junções e Vigas', [
                inspectable('8.7.1.juncoes_fixacao', 'Fixação e aperto geral de parafuso e porcas'),
                inspectable('8.7.1.juncoes_soldas', 'Soldas e parafusos ausência de trincas, fissuras ou corrosão'),
                inspectable('8.7.1.juncoes_deformacao', 'Deformação ausência de empenamento'),
            ], 3),
            section('8.7.2', '8.7.2 Cabeceira', [
                inspectable('8.7.2.cabeceira_rodas', 'Rodas ausência de desgastes nos frisos e bandas de rodagem'),
                inspectable('8.7.2.cabeceira_rolamentos', 'Rolamentos ausência de ruídos ou travamento e lubrificado'),
            ], 3),
        ]),
    ]),
    mainSection(9, '9 Célula de carga', [
        inspectable('9.amassados', 'Ausência de amassados, trincas, corrosão'),
        inspectable('9.fixacao', 'Fixação e reaperto'),
        inspectable('9.cabos', 'Cabos e conexões ausência de cortes, esmagamento'),
        inspectable('9.calibracao', 'Calibração ausência de desvios acima da tolerância'),
        inspectable('9.sensores', 'Atuação de sensores (limite de peso)'),
    ]),
    mainSection(10, '10 Testes operacionais', [
        textareaField('10.observacoes', 'Observações'),
    ]),
];

/** Percorre todos os campos folha do schema */
export function walkChecklistFields(schema, callback) {
    function walk(nodes) {
        nodes.forEach(node => {
            if (node.fieldType) callback(node);
            else if (node.children) walk(node.children);
        });
    }
    walk(schema);
}

/** Cria objeto responses vazio */
export function createEmptyResponses() {
    const responses = {};
    walkChecklistFields(CHECKLIST_SCHEMA, field => {
        if (field.fieldType === 'inspectable') {
            responses[field.id] = { status: null, observation: '', images: [] };
        } else {
            responses[field.id] = { value: '' };
        }
    });
    return responses;
}
