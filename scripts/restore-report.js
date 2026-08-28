import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pbfrgdkjahnawwlspzbb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RL_Pv09T26Z0ePOljNSzCA_3-uemBkE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const reportBackup = {
  "id": "REL - 01",
  "status": "FINALIZED",
  "type": "PREVENTIVA",
  "empresa": "AUTOKINITON",
  "equipamentoId": "#EQP-0001",
  "equipamentoNome": "PONTE ROLANTE VIGA DUPLA",
  "assetInfo": "PONTE ROLANTE VIGA DUPLA — AUTOKINITON",
  "date": "07/08/2026",
  "createdAt": null,
  "updatedAt": null,
  "responses": {
    "2.radio": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_2.radio_0_1786285839450.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_2.radio_1_1786285839451.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_2.radio_2_1786285839451.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO A MANUTENÇÃO PREVENTIVA E TESTES OPERACIONASO NO SISTEMA DE CONTROLE DO EQUIPAMENTO E NÃO DETECTADO NENHUMAANOMALIA NO CONJUNTO DE RÁDIO CONTROLE (TRANSMISSOR E RECEPTOR) OU NO SISTEMA RESERVA (BOTOEIRA).",
      "additionalObservations": []
    },
    "9.cabos": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "1.carros": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.4.oleo": {
      "images": [],
      "status": "NOK",
      "observation": ""
    },
    "6.4.oleo": {
      "images": [],
      "status": "NOK",
      "observation": ""
    },
    "3.fixacao": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_3.fixacao_0_1786285839834.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_3.fixacao_1_1786285839834.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_3.fixacao_2_1786285839834.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_3.fixacao_3_1786285839834.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_3.fixacao_4_1786285839835.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_3.fixacao_5_1786285839835.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_3.fixacao_6_1786285839835.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_3.fixacao_7_1786285839835.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO MANUTENÇÃO PREVENTIVA NO PAINEL ELÉTRICO. VERIFICANDO A FIXAÇÃO E REAPERTO DOS COMPONENTES (BORNES, DISJUNTORES,CONTATORES, ETC), TENSÃO DE ENTRADA, TENSÃO DE COMANDO. CONSTATADO QUE O PAINEL ENCONTRA-SE OPERACIONAL. IDENTIFICADO QUE ASFECHADURAS DA PORTA PRINCIPAL ENCONTRAM-SE AVARIADAS. RECOMENDADO A SUBSTITUIÇÃO.",
      "additionalObservations": []
    },
    "4.fixacao": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_4.fixacao_0_1786285840549.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_4.fixacao_1_1786285840550.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_4.fixacao_2_1786285840550.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_4.fixacao_3_1786285840550.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO MANUTENÇÃO PREVENTIVA NO PAINEL ELÉTRICO. VERIFICANDO A FIXAÇÃO E REAPERTO DOS COMPONENTES (BORNES, DISJUNTORES,CONTATORES, ETC). CONSTATADO QUE O PAINEL ENCONTRA-SE OPERACIONAL. IDENTIFICADO QUE QUE A PORTA DO PAINEL ENCONTRA-SE AVARIADA, COMAS FECHADURAS DANIFICADAS. RECOMENDADO A SUBSTITUIÇÃO.",
      "additionalObservations": []
    },
    "5.4.eixos": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.7.2.din": {
      "value": "OK"
    },
    "5.8.pinos": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.4.eixos": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.7.2.din": {
      "value": "OK"
    },
    "6.8.pinos": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "9.fixacao": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "2.botoeira": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.2.ajuste": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.5.voltas": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.8.polias": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.8.polias_0_1786285841092.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.8.polias_1_1786285841092.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.8.polias_2_1786285841092.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO INSPEÇÃO TÉCNICA. CONJUNTO DE CAIXA DO GANCHO BLOCO SUPERIOR ENCONTRA-SE EM BOAS CONDIÇÕES E NÃO APRESENTA ANOMALIAS.",
      "additionalObservations": []
    },
    "6.2.ajuste": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.5.voltas": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.8.polias": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.8.polias_0_1786285841396.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.8.polias_1_1786285841396.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.8.polias_2_1786285841397.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO INSPEÇÃO TÉCNICA NO BLOCO SUPERIOR. CONSTATADO QUE O CONJUNTO ENCONTRA-SE EM BOAS CONDIÇÕES, NÃO APRESENTANDODESGASTE EXCESSIVO OU QUAISQUER ANOMALIAS.",
      "additionalObservations": []
    },
    "9.sensores": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.1.limpeza": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.3.fixacao": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.3.fixacao_0_1786285841694.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.3.fixacao_1_1786285841694.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.3.fixacao_2_1786285841694.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.3.fixacao_3_1786285841694.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO A INSPEÇÃO TÉCNICA NO SISTEMA E CONSTATADO QUE AS CHAVES FIM DE CURSO (SUBIDA, DESCIDA E REDUNDANTE DE SUBIDA) ENCONTRAMSE EM BOAS CONDIÇÕES E OPERANDO NORMALMENTE",
      "additionalObservations": []
    },
    "5.4.vedacao": {
      "images": [],
      "status": "NOK",
      "observation": ""
    },
    "5.6.1.danos": {
      "value": "1"
    },
    "5.6.fixacao": {
      "images": [],
      "status": "OK",
      "observation": "REALIZADO INSPEÇÃO TÉCNICA. CONSTATADO QUE O CABO DE AÇO SE ENCONTRA EM BOAS CONDIÇÕES E NÃO APRESENTA NENHUMA ANOMALIA",
      "additionalObservations": []
    },
    "5.7.1.trava": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.8.fixacao": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.8.mancais": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.1.limpeza": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.3.fixacao": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.3.fixacao_0_1786285841997.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.3.fixacao_1_1786285841998.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.3.fixacao_2_1786285841998.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.3.fixacao_3_1786285841998.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO INSPEÇÃO TÉCNICA. CONSTATADO QUE AS CHAVES FINS DE CURSO (SUBIDA, DESCIDA E REDUNDANTE DE SUBIDA) ENCONTRAM-SE EM BOASCONDIÇÕES E OPERANDO NORMALMENTE.",
      "additionalObservations": []
    },
    "6.4.vedacao": {
      "images": [],
      "status": "NOK",
      "observation": ""
    },
    "6.6.1.danos": {
      "value": "1"
    },
    "6.6.fixacao": {
      "images": [],
      "status": "OK",
      "observation": "REALIZADO INSPEÇÃO TÉCNICA. CONSTATADO QUE O CABO DE AÇO SE ENCONTRA EM BOAS CONDIÇÕES E NÃO APRESENTA NENHUMA ANOMALIA",
      "additionalObservations": []
    },
    "6.7.1.trava": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.8.fixacao": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.8.mancais": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "9.amassados": {
      "images": [],
      "status": "OK",
      "observation": "",
      "additionalObservations": []
    },
    "5.1.conexoes": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.1.vibracao": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.2.desgaste": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.2.desgaste_0_1786285842543.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.2.desgaste_1_1786285842544.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.2.desgaste_2_1786285842544.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.2.desgaste_3_1786285842544.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.2.desgaste_4_1786285842544.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO A MANUTENÇÃO PREVENTIVA. CONSTATADO QUE O FREIO DE ELEVAÇÃO PRINCIPAL (ALTA VELOCIDADE) ENCONTRA-SE EM BOAS CONDIÇÕES EOPERANDO NORMALMENTE.DETECTADO VAZAMENTO DO REDUTOR DA MICRO VELOCIDADE INFILTRANDO NO SISTEMA E QUE O FREIO DA (MICRO VELOCIDADE) APRESENTA DESGASTENA BASE DE FRENAGEM DA TAMPA DO MOTOR (MANCAL B CÓDIGO: 616 629 44 / 6161 635 44). RECOMENDADO A DESMONTAGEM DOS CONJUNTOS PARACORREÇÃO DE VEDAÇÕES E SUBSTITUIÇÃO DE COMPONENTES AVARIADOS.",
      "additionalObservations": []
    },
    "5.5.ranhuras": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.5.ranhuras_0_1786285843045.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.5.ranhuras_1_1786285843046.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO INSPEÇÃO TÉCNICA. CONSTATADO QUE O TAMBOR DO CABO DE AÇO ENCONTRA SE EM BOAS CONDIÇÕES NÃO APRESENTANDO DESGASTEEXCESSIVO NOS CANAIS (ESPIRAS), FOLGAS OU QUAISQUER ANOMALIAS.",
      "additionalObservations": []
    },
    "5.6.1.arames": {
      "value": "NÃO"
    },
    "5.6.1.bitola": {
      "value": "3/4\""
    },
    "5.6.desgaste": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.7.1.mancal": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.8.vedacoes": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.1.conexoes": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.1.vibracao": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.2.desgaste": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.2.desgaste_0_1786285843341.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.2.desgaste_1_1786285843341.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.2.desgaste_2_1786285843341.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.2.desgaste_3_1786285843342.jpeg"
      ],
      "status": "NOK",
      "observation": "REALIZADO A MANUTENÇÃO PREVENTIVA NO CONJUNTO DE FREIO. DETECTADO DESGASTE EXCESSIVO NO SISTEMA DE FRENAGEM, ASSIM REALIZAMOS ASUBSTITUIÇÃO POR NOVO CONJUNTO FORNECIDO PELA EQUIPE DE MANUTENÇÃO AUTOKINITON E REESTABELECENDO A INTEGRIDADE DO SISTEMA.",
      "additionalObservations": []
    },
    "6.5.ranhuras": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.5.ranhuras_0_1786285843862.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.5.ranhuras_1_1786285843862.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADIO INSPEÇÃO TÉCNICA. CONSTATADO QUE O TAMBOR DO CABO DE AÇO ENCONTRA-SE EM BOAS CONDIÇÕES, NÃO APRESENTANDO DESGASTEEXCESSIVO NOS CANAIS (ESPIRAS), FOLGAS OU QUAISQUER ANOMALIAS.",
      "additionalObservations": []
    },
    "6.6.1.arames": {
      "value": "NÃO"
    },
    "6.6.1.bitola": {
      "value": "5,8\""
    },
    "6.6.desgaste": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.7.1.mancal": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.8.vedacoes": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "9.calibracao": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "1.alinhamento": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_1.alinhamento_0_1786285844165.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_1.alinhamento_1_1786285844165.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_1.alinhamento_2_1786285844165.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADA A MANUTENÇÃO PREVENTIVA E CONSTATADO QUE O SISTEMA ENCONTRA SE EM BOAS CONDIÇÕES NÃO APRESENTANDO DESALINHAMENTO /DESNIVELAMENTO, DESGASTES EXCESSIVOS NOS CARROS COLETORES OU QUAISQUER ANOMALIAS.",
      "additionalObservations": [
        {
          "images": [
            "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/addobs_1.alinhamento_0_0_1786285844440.jpeg",
            "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/addobs_1.alinhamento_0_1_1786285844441.jpeg",
            "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/addobs_1.alinhamento_0_2_1786285844441.jpeg"
          ],
          "observation": "REALIZADO A SUBSTITUIÇÃO DO SUPORTE DE ARRASTE DOS CARROS COLETORES DEVIDO AO EXISTENTE SER DE COMPRIMENTO NÃO COMPATÍVEL COM OEQUIPAMENTO E APÓS A SUBSTITUIÇÃO REALIZAMOS OS TESTES POR TODA A EXTENSÃO DO PERCURSO DE TRANSLADO DO EQUIPAMENTO OBTENDORESULTADO SATISFATÓRIO."
        }
      ]
    },
    "1.nivelamento": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.6.1.reducao": {
      "value": "NÃO"
    },
    "5.7.1.trincas": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.6.1.reducao": {
      "value": "NÃO"
    },
    "6.7.1.trincas": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "10.observacoes": {
      "value": "NÃO FOI POSSÍVEL REALIZAR TESTES COM CARGA DEVIDO A INDISPONIBILIDADE DE CARGA E AUSÊNCIA DE PESSOAL AUTORIZADO A OPERAÇÃO EMANUSEIO DE FERRAMENTAS (MOLDES), NO ENTANTO, REALIZAMOS TODOS OS TESTES COM O EQUIPAMENTO OBTENDO RESULTADO SATISFATÓRIO.",
      "images": []
    },
    "5.1.rolamentos": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.6.1.corrosao": {
      "value": "1"
    },
    "5.6.1.diametro": {
      "value": "19 MM"
    },
    "5.7.1.abertura": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.7.1.abertura_0_1786285844821.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.7.1.abertura_1_1786285844823.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.7.1.abertura_2_1786285844824.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO INSPEÇÃO TÉCNICA. CONJUNTO DE CAIXA DE GANCHO SE ENCONTRA EM BOAS CONDIÇÕES. RECOMENDADO A SUBSTITUIÇÃO DAS ROLDANASQUE ESTÃO COM DESGASTES.",
      "additionalObservations": []
    },
    "5.7.1.roldanas": {
      "images": [],
      "status": "NOK",
      "observation": ""
    },
    "5.7.2.abertura": {
      "value": "200 MM"
    },
    "5.7.2.protecao": {
      "value": "OK"
    },
    "5.8.rolamentos": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.1.isolamento": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.1.rolamentos": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.6.1.corrosao": {
      "value": "1"
    },
    "6.6.1.diametro": {
      "value": "16 MM"
    },
    "6.7.1.abertura": {
      "images": [],
      "status": "OK",
      "observation": "REALIZADO INSPEÇÃO TÉCNICA. CONJUNTO DE CAIXA DE GANCHO ENCONTRA-SE EM BOAS CONDIÇÕES.",
      "additionalObservations": []
    },
    "6.7.1.roldanas": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.7.2.abertura": {
      "value": "200 MM"
    },
    "6.7.2.protecao": {
      "value": "OK"
    },
    "6.8.rolamentos": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.1.alinhamento": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.1.alinhamento_0_1786285845124.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.1.alinhamento_1_1786285845126.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.1.alinhamento_2_1786285845127.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.1.alinhamento_3_1786285845128.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO A MANUTENÇÃO PREVENTIVA. CONSTATADO QUE OS MOTORES DA ELEVAÇÃO PRINCIPAL ENCONTRAM-SE COM A FIXAÇÃO E CONEXÕESELÉTRICAS EM BOAS CONDIÇÕES E OPERANDO NORMALMENTE.",
      "additionalObservations": []
    },
    "5.3.acionamento": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.4.alinhamento": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.4.alinhamento_0_1786285845438.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.4.alinhamento_1_1786285845439.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.4.alinhamento_2_1786285845440.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZANDO MANUTENÇÃO PREVENTIVA. IDENTIFICADO A PERDA DE ESTANQUEIDADE NO REDUTOR DE ELEVAÇÃO PRINCIPAL. RECOMENDADO ADESMONTAGEM DO CONJUNTO PARA SUBSTITUIÇÃO DOS ELEMENTOS DE VEDAÇÃO, VISANDO RESTABELECER A INTEGRIDADE DO SISTEMA.",
      "additionalObservations": []
    },
    "5.4.engrenagens": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.5.enrolamento": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.6.esmagamento": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.1.alinhamento": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.1.alinhamento_0_1786285845988.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.1.alinhamento_1_1786285845989.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.1.alinhamento_2_1786285845989.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.1.alinhamento_3_1786285845991.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO MANUTENÇÃO PREVENTIVA. CONSTATADO QUE OS MOTORES DA ELEVAÇÃO AUXILIAR ENCONTRAM-SE COM A FIXAÇÃO E CONEXÕES ELÉTRICASEM BOAS CONDIÇÕES E OPERANDO NORMALMENTE.",
      "additionalObservations": []
    },
    "6.3.acionamento": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.4.alinhamento": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.4.alinhamento_0_1786285846514.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.4.alinhamento_1_1786285846521.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO MANUTENÇÃO PREVENTIVA. CONSTATADO QUE O REDUTOR DE ELEVAÇÃO AUXILIAR APRESENTA VAZAMENTO EXCESSIVO SENDO RECOMENDADOA DESMONTAGEM PARA CORREÇÕES DE VEDAÇÃO A FIM DE EVITAR DANOS POSTERIORES AO SISTEMA.",
      "additionalObservations": []
    },
    "6.4.engrenagens": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.5.enrolamento": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.6.esmagamento": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "7.5.rodas_folga": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "8.5.rodas_folga": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "3.tensao_comando": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "3.tensao_entrada": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "4.tensao_entrada": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.7.1.rolamentos": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.7.2.capacidade": {
      "value": "OK"
    },
    "5.7.2.penetrante": {
      "value": "OK"
    },
    "5.8.lubrificacao": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.7.1.rolamentos": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.7.2.capacidade": {
      "value": "OK"
    },
    "6.7.2.penetrante": {
      "value": "N/A"
    },
    "6.8.lubrificacao": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "7.3.fins_fixacao": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.3.fins_fixacao_0_1786285846789.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.3.fins_fixacao_1_1786285846790.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO A MANUTENÇÃO PREVENTIVA. VERIFICADO CONTATOS E REALIZADO TESTES. CONSTATADO QUE O DISPOSITIVO DE FIM DE CURSO ENCONTRA-SE EM BOAS CONDIÇÕES E OPERANDO NORMALMENTE",
      "additionalObservations": []
    },
    "5.6.1.observacoes": {
      "value": "",
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.6.1.observacoes_0_1786285847110.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.6.1.observacoes_1_1786285847113.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_5.6.1.observacoes_2_1786285847113.jpeg"
      ]
    },
    "5.7.2.observacoes": {
      "value": "",
      "images": []
    },
    "6.6.1.observacoes": {
      "value": "",
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.6.1.observacoes_0_1786285847408.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.6.1.observacoes_1_1786285847409.jpeg"
      ]
    },
    "6.7.2.observacoes": {
      "value": "",
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.7.2.observacoes_0_1786285847946.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.7.2.observacoes_1_1786285847947.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_6.7.2.observacoes_2_1786285847947.jpeg"
      ]
    },
    "7.2.freios_ajuste": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "7.5.rodas_trilhos": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "8.2.freios_ajuste": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.6.1.deterioracao": {
      "value": "1"
    },
    "6.6.1.deterioracao": {
      "value": "1"
    },
    "7.4.redutores_oleo": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "7.5.rodas_desgaste": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.5.rodas_desgaste_0_1786285848260.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.5.rodas_desgaste_1_1786285848261.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.5.rodas_desgaste_2_1786285848262.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADA INSPEÇÃO. CONSTATADO QUE O CONJUNTO DE RODAS DO CARRO (MOTRIZES/LIVRES) ENCONTRAM-SE EM BOAS CONDIÇÕES E EMCONFORMIDADE COM A NORMA NBR 84000-3, NÃO APRESENTANDO DESGASTES EXCESSIVOS, FOLGAS EXCESSIVAS (RODA/TRILHO) OU QUAISQUERANOMALIAS.",
      "additionalObservations": []
    },
    "7.6.4.loops_curvas": {
      "images": [],
      "status": "OK",
      "observation": "",
      "additionalObservations": []
    },
    "7.6.caminho_soldas": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "8.4.redutores_oleo": {
      "images": [],
      "status": "NOK",
      "observation": ""
    },
    "8.5.rodas_desgaste": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.5.rodas_desgaste_0_1786285848534.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.5.rodas_desgaste_1_1786285848536.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.5.rodas_desgaste_2_1786285848536.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.5.rodas_desgaste_3_1786285848537.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.5.rodas_desgaste_4_1786285848538.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.5.rodas_desgaste_5_1786285848540.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO INSPEÇÃO TÉCNICA. CONSTATADO QUE O CONJUNTO DE RODAS DE TRANSLAÇÃO DA PONTE (MOTRIZES/LIVRES) ENCONTRAM-SE EM BOASCONDIÇÕES E EM CONFORMIDADE COM A NORMA NBR 84000-3. NÃO APRESENTANDO DESGASTES EXCESSIVOS, FOLGAS EXCESSIVAS (RODA/TRILHO) OUQUAISQUER ANOMALIAS",
      "additionalObservations": []
    },
    "8.6.caminho_soldas": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "7.1.motores_limpeza": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "7.2.freios_desgaste": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.2.freios_desgaste_0_1786285849077.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.2.freios_desgaste_1_1786285849078.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.2.freios_desgaste_2_1786285849079.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO A MANUTENÇÃO PREVENTIVA. EXECUTADO A DESMONTAGEM DO CONJUNTO PARA LIMPEZA E REGULAGEM. CONSTATADO QUE O SISTEMA DEFREIOS DA TRANSLAÇÃO DO CARRO, ENCONTRA-SE COM AS MEDIDAS DE REGULAGEM DENTRO DOS PADRÕES ADMISSÍVEIS E OPERANDO NORMALMENTE.",
      "additionalObservations": []
    },
    "7.4.redutores_eixos": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "7.6.1.cabos_arraste": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "7.6.caminho_trilhos": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.6.caminho_trilhos_0_1786285849506.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.6.caminho_trilhos_1_1786285849507.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO INSPEÇÃO NO CAMINHO DE ROLAMENTO DO CARRO. CONSTATADO QUE O MESMO ENCONTRA-SE EM BOAS CONDIÇÕES E EM CONFORMIDADECOM A NBR16197.",
      "additionalObservations": []
    },
    "8.1.motores_limpeza": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "8.2.freios_desgaste": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.2.freios_desgaste_0_1786285849793.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.2.freios_desgaste_1_1786285849795.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.2.freios_desgaste_2_1786285849797.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.2.freios_desgaste_3_1786285849797.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO A MANUTENÇÃO PREVENTIVA NO SISTEMA. CONSTATADO QUE O CONJUNTO DE FREIO DE TRANSLAÇÃO ENCONTRA-SE EM BOM ESTADO, COMMEDIDAS DENTRO DOS PADRÕES ADMISSÍVEIS E OPERANDO NORMALMENTE.",
      "additionalObservations": []
    },
    "8.4.redutores_eixos": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "8.6.caminho_trilhos": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.6.caminho_trilhos_0_1786285850079.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.6.caminho_trilhos_1_1786285850079.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.6.caminho_trilhos_2_1786285850080.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.6.caminho_trilhos_3_1786285850080.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO INSPEÇÃO VISUAL NO CAMINHO DE ROLAMENTO (JÁ EM PROCESSO DE MANUTENÇÃO CORRETIVA).",
      "additionalObservations": []
    },
    "7.1.motores_conexoes": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "7.1.motores_vibracao": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "7.3.fins_acionamento": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "7.6.1.cabos_conexoes": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "7.6.2.troles_fixacao": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "8.1.motores_conexoes": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "8.1.motores_vibracao": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "8.3.sensores_fixacao": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.3.sensores_fixacao_0_1786285850547.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.3.sensores_fixacao_1_1786285850550.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO A MANUTENÇÃO PREVENTIVA NOS SENSORES ANTICOLISÃO, REVISÃO DOS CONECTORES E POSTERIOR TESTES. CONSTATADO QUE OSSENSORES ENCONTRAM-SE EM BOAS CONDIÇÕES E ATUANDO NORMALMENTE.",
      "additionalObservations": []
    },
    "8.7.1.juncoes_soldas": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "5.6.1.diametro_medido": {
      "value": "19 MM"
    },
    "5.7.1.desgastes_canal": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "6.6.1.diametro_medido": {
      "value": "15,7 MM"
    },
    "6.7.1.desgastes_canal": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "7.4.redutores_vedacao": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "7.6.2.troles_rodizios": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "8.4.redutores_vedacao": {
      "images": [],
      "status": "NOK",
      "observation": ""
    },
    "8.7.1.juncoes_fixacao": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.7.1.juncoes_fixacao_0_1786285850871.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.7.1.juncoes_fixacao_1_1786285850872.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.7.1.juncoes_fixacao_2_1786285850873.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO O REAPERTO DOS PARAFUSOS DE MAIOR RELEVÂNCIA PARA O EQUIPAMENTO (JUNÇÕES VIGAS/CABECEIRAS E CARRO TALHA) E CONSTATAMOSQUE A ESTRUTURA SE ENCONTRA COM EM BOAS CONDIÇÕES, NÃO APRESENTANDO FOLGAS NAS UNIÕES PARAFUSADAS OU QUAISQUER ANOMALIAS.",
      "additionalObservations": []
    },
    "8.7.2.cabeceira_rodas": {
      "images": [],
      "status": "OK",
      "observation": "",
      "additionalObservations": []
    },
    "7.1.motores_isolamento": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "7.1.motores_rolamentos": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "7.6.1.cabos_isolamento": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.6.1.cabos_isolamento_0_1786285851180.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.6.1.cabos_isolamento_1_1786285851181.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.6.1.cabos_isolamento_2_1786285851181.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO MANUTENÇÃO PREVENTIVA NA LINHA FESTOON (CORTINA DE CABOS). VERIFICADO FIXAÇÃO DOS CABOS E REAPERTO DOS BORNES DECONEXÃO DA MESMA E NÃO CONSTATAMOS NENHUMA ANORMALIDADE NO CONJUNTO.",
      "additionalObservations": []
    },
    "7.6.2.troles_movimento": {
      "images": [],
      "status": "OK",
      "observation": "",
      "additionalObservations": []
    },
    "7.6.3.trilhos_desgaste": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "8.1.motores_isolamento": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "8.1.motores_rolamentos": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "7.1.motores_alinhamento": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.1.motores_alinhamento_0_1786285851465.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.1.motores_alinhamento_1_1786285851467.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.1.motores_alinhamento_2_1786285851468.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.1.motores_alinhamento_3_1786285851469.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO MANUTENÇÃO PREVENTIVA. CONSTATADO QUE MOTORES DE TRANSLAÇÃO DO CARRO ENCONTRAM-SE EM BOAS CONDIÇÕES. DETECTADO QUEUM DOS MOTORES ENCONTRA-SE SEM A VENTOINHA DE REFRIGERAÇÃO,. RECOMENDADO A REPOSIÇÃO A FIM DE PREVENIR CONTRA DANOS FUTUROS.",
      "additionalObservations": []
    },
    "7.6.caminho_nivelamento": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "8.1.motores_alinhamento": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.1.motores_alinhamento_0_1786285852034.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.1.motores_alinhamento_1_1786285852034.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.1.motores_alinhamento_2_1786285852035.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO A MANUTENÇÃO PREVENTIVA NOS MOTORES DE TRANSLAÇÃO DA PONTE ROLANTE. CONSTATADO QUE OS MESMOS ENCONTRAM-SE EM BOASCONDIÇÕES, COM AS FIXAÇÕES E CONEXÕES ELÉTRICAS EM BOAS CONDIÇÕES E OPERANDO NORMALMENTE",
      "additionalObservations": []
    },
    "8.6.caminho_nivelamento": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "8.3.sensores_acionamento": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "8.7.1.juncoes_deformacao": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "custom_1786129861263_obs": {
      "value": "REALIZAR A DESMONTAGEM DO MOTOR MICRO DA ELEVAÇÃO PRINCIPAL PARA CORREÇÕES DE VEDAÇÃO.\nREALIZAR REPARO DO VAZAMENTO DO REDUTOR DE ELEVAÇÃO AUXILIAR.\nREALIZAR REPARO DO VAZAMENTO NO REDUTOR DE TRANSLAÇÃO DA PONTE; (LADO OPOSTO O BARRAMENTO).\nREALIZAR A SUBSTITUIÇÃO DA TAMPA DO MOTOR (MANCAL LADO DO FREIO B, CÓDIGO (61662944/616163544), MICRO VELOCIDADE.\nREALIZAR A SUBSTITUIÇÃO DAS ROLDANAS DA CAIXA DE GANCHO DA ELEVAÇÃO PRINCIPAL (2 PEÇAS).",
      "images": []
    },
    "custom_1786129914141_obs": {
      "value": "REALIZAR A INSTALAÇÃO DE FECHADURA NAS PORTAS DOS PAINÉIS (PRINCIPAL E DO CARRO).\nINSTALAR TRAVA E VENTOINHA EM UM DO MOTOR DE TRANSLAÇÃO DO CARRO.",
      "images": []
    },
    "custom_1786129953776_obs": {
      "value": "COM O EXPOSTO ACIMA, INFORMAMOS QUE É SE FAZ NECESSÁRIO QUE SEJA REALIZADO A CORREÇÕES DESCRITAS NO ITEM 11 DESTE RELATÓRIO, A FIMDE GARANTIR A INTEGRIDADE DO EQUIPAMENTO E SEUS OPERADORES.COMO RECOMENDAÇÃO, SUGERIMOS QUE SEJAM REALIZADOS OS REPAROS DESCRITOS NO ITEM 12 DESTE RELATÓRIO, A FIM DE GARANTIR AOPERACIONALIDADE DO EQUIPAMENTO.",
      "images": []
    },
    "custom_1786130003692_obs": {
      "value": "• NBR 8400 - Cálculo de Equipamento para levantamento e movimentação de cargas;\n• NBR 5410 – Instalações Elétricas de baixa tensão;\n• NR 10 – Segurança em Instalações e Serviços em Eletricidade;\n• NR-12 – Segurança no Trabalho em Máquinas e Equipamentos;\n• NR-35 – Trabalho em Altura;\n• NR-18 – Condições e Meio Ambiente de Trabalho na Indústria;\n• NBR ISO 4309 – Inspeção e descarte de cabos de aço;\n• NBR 16197 - Cálculo dos caminhos de rolamento em base elástica contínua para equipamentos de levantamento e movimentação de cargas;\n• DIN 15405 – Lasthaken fur Hebezeuge;",
      "images": []
    },
    "7.4.redutores_alinhamento": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.4.redutores_alinhamento_0_1786285852569.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.4.redutores_alinhamento_1_1786285852569.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.4.redutores_alinhamento_2_1786285852570.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_7.4.redutores_alinhamento_3_1786285852571.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO A MANUTENÇÃO PREVENTIVA. CONSTATADO QUE OS MESMOS ENCONTRAM-SE EM BOAS CONDIÇÕES, NÃO APRESENTANDO VAZAMENTOS,RUÍDOS EXCESSIVOS OU QUAISQUER ANOMALIAS",
      "additionalObservations": []
    },
    "7.4.redutores_engrenagens": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "7.6.3.trilhos_alinhamento": {
      "images": [],
      "status": "OK",
      "observation": "",
      "additionalObservations": []
    },
    "8.4.redutores_alinhamento": {
      "images": [
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.4.redutores_alinhamento_0_1786285853081.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.4.redutores_alinhamento_1_1786285853081.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.4.redutores_alinhamento_2_1786285853083.jpeg",
        "https://pbfrgdkjahnawwlspzbb.supabase.co/storage/v1/object/public/crane-app-media/reports/REL%20-%2001/item_8.4.redutores_alinhamento_3_1786285853083.jpeg"
      ],
      "status": "OK",
      "observation": "REALIZADO A MANUTENÇÃO PREVENTIVA. CONSTATADO QUE OS REDUTORES DE TRANSLAÇÃO SE ENCONTRAM OPERACIONAIS. DETECTADO QUE OREDUTOR DO LADO OPOSTO AO BARRAMENTO ENCONTRA-SE COM VAZAMENTO MÍNIMO DE ÓLEO, RECOMENDAMOS QUE SEJA REALIZADO A MANUTENÇÃOPARA CORRIGIR VEDAÇÃO E EVITAR DANOS AO EQUIPAMENTO.",
      "additionalObservations": []
    },
    "8.4.redutores_engrenagens": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "8.7.2.cabeceira_rolamentos": {
      "images": [],
      "status": "OK",
      "observation": ""
    },
    "custom_item_3_1786121225272": {
      "images": [],
      "status": "NOK",
      "observation": "",
      "additionalObservations": []
    },
    "custom_item_4_1786121386772": {
      "images": [],
      "status": "NOK",
      "observation": "",
      "additionalObservations": []
    },
    "custom_item_5.2_1786125097978": {
      "images": [],
      "status": "NOK",
      "observation": "",
      "additionalObservations": []
    },
    "custom_item_5.2_1786125105537": {
      "images": [],
      "status": "NOK",
      "observation": "",
      "additionalObservations": []
    }
  },
  "generalObservation": "",
  "responsaveis": [
    "3",
    "2",
    "4"
  ],
  "tecnico": "",
  "customItems": [
    {
      "id": "custom_item_3_1786121225272",
      "label": "FECHADURAS DA PORTA PRINCIAL",
      "fieldType": "inspectable",
      "sectionId": "3"
    },
    {
      "id": "custom_item_4_1786121386772",
      "label": "porta do painel",
      "fieldType": "inspectable",
      "sectionId": "4"
    },
    {
      "id": "custom_item_5.2_1786125097978",
      "label": "BASE DE FRENAGEM DA TAMPA",
      "fieldType": "inspectable",
      "sectionId": "5.2"
    },
    {
      "id": "custom_item_5.2_1786125105537",
      "label": "AUSENCIA DE VAZAMENTO REDUTOR MICRO VELOCIDADE",
      "fieldType": "inspectable",
      "sectionId": "5.2"
    }
  ],
  "customSections": [
    {
      "id": "custom_1786129861263",
      "level": 1,
      "title": "11 AÇÕES IMPRESCINDÍVEIS",
      "children": [
        {
          "id": "custom_1786129861263_obs",
          "label": "OBSERVAÇÕES",
          "fieldType": "textarea"
        }
      ]
    },
    {
      "id": "custom_1786129914141",
      "level": 1,
      "title": "12 AÇÕES RECOMENDADAS",
      "children": [
        {
          "id": "custom_1786129914141_obs",
          "label": "OBSERVAÇÕES",
          "fieldType": "textarea"
        }
      ]
    },
    {
      "id": "custom_1786129953776",
      "level": 1,
      "title": "13 CONSIDERAÇÕES FINAIS",
      "children": [
        {
          "id": "custom_1786129953776_obs",
          "label": "OBSERVAÇÕES",
          "fieldType": "textarea"
        }
      ]
    },
    {
      "id": "custom_1786130003692",
      "level": 1,
      "title": "14 REFERÊNCIAS NORMATIVAS",
      "children": [
        {
          "id": "custom_1786130003692_obs",
          "label": "OBSERVAÇÕES",
          "fieldType": "textarea"
        }
      ]
    }
  ],
  "generalImages": []
};

async function restore() {
  console.log('Restaurando REL - 01 no Supabase...');
  const row = {
    id: reportBackup.id,
    status: reportBackup.status || 'FINALIZED',
    type: reportBackup.type || 'PREVENTIVA',
    empresa: reportBackup.empresa || '',
    equipamentoId: reportBackup.equipamentoId || '',
    equipamentoNome: reportBackup.equipamentoNome || '',
    assetInfo: reportBackup.assetInfo || `${reportBackup.equipamentoNome} — ${reportBackup.empresa}`,
    date: reportBackup.date || '',
    responsaveis: reportBackup.responsaveis || [],
    responses: {
      ...(reportBackup.responses || {}),
      __meta: {
        schema: reportBackup.schema_snapshot || reportBackup.schema || null,
        schema_snapshot: reportBackup.schema_snapshot || reportBackup.schema || null,
        templateId: reportBackup.templateId || null,
        templateName: reportBackup.templateName || null
      }
    },
    generalObservation: reportBackup.generalObservation || '',
    generalImages: reportBackup.generalImages || [],
    customSections: reportBackup.customSections || [],
    customItems: reportBackup.customItems || [],
    tecnico: reportBackup.tecnico || ''
  };

  const { data, error } = await supabase
    .from('finalized_reports')
    .upsert([row], { onConflict: 'id' });

  if (error) {
    console.error('ERRO AO RESTAURAR NO SUPABASE:', error);
    process.exit(1);
  } else {
    console.log('SUCESSO! REL - 01 restaurado com sucesso no Supabase!');
  }
}

restore();
