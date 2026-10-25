export interface KnowledgeTemplateItem {
  category: 'faq' | 'service' | 'product' | 'policy' | 'general';
  title: string;
  content: string;
}

export const SEGMENT_TEMPLATES: Record<string, KnowledgeTemplateItem[]> = {
  'Clínicas & Saúde': [
    {
      category: 'service',
      title: 'Consultas, Especialidades e Valores',
      content:
        'Atendemos consultas particulares e retorno em até 30 dias. Informe ao paciente as especialidades disponíveis e oriente que valores exatos e horários livres são confirmados rapidamente mediante envio do nome completo e turno de preferência (manhã ou tarde).',
    },
    {
      category: 'faq',
      title: 'Convênios e Reembolso',
      content:
        'Emitimos nota fiscal detalhada para solicitação de reembolso junto ao plano de saúde. Caso o paciente pergunte sobre um convênio específico, informe quais atendemos ou ofereça condição especial no particular.',
    },
    {
      category: 'policy',
      title: 'Confirmação, Atrasos e Remarcação',
      content:
        'Pedimos confirmação com 24h de antecedência. Em caso de imprevisto, solicitamos avisar com pelo menos 4 horas de antecedência para reagendarmos sem custo.',
    },
    {
      category: 'faq',
      title: 'Endereço, Estacionamento e Horário',
      content:
        'Atendemos de segunda a sexta das 08h às 18h e aos sábados das 08h às 12h. Edite este item com seu endereço completo e ponto de referência.',
    },
  ],
  'Imobiliárias & Corretores': [
    {
      category: 'service',
      title: 'Compra, Venda e Locação de Imóveis',
      content:
        'Trabalhamos com casas, apartamentos e salas comerciais para compra e locação. Pergunte ao cliente: 1) Compra ou aluguel, 2) Bairro/região desejada, 3) Quantidade de quartos e 4) Faixa de valor aproximada.',
    },
    {
      category: 'faq',
      title: 'Documentação para Locação e Financiamento',
      content:
        'Para locação trabalhamos com seguro-fiança, caução ou fiador. Para compra, fazemos simulação gratuita de financiamento bancário com todos os bancos e uso do FGTS.',
    },
    {
      category: 'service',
      title: 'Agendamento de Visita ao Imóvel',
      content:
        'As visitas são acompanhadas por corretor credenciado de segunda a sábado. Peça o nome do cliente, o código/link do imóvel de interesse e duas opções de dia e horário.',
    },
    {
      category: 'faq',
      title: 'Captação: Anunciar Meu Imóvel',
      content:
        'Se o proprietário quiser vender ou alugar seu imóvel conosco, colete bairro, tipo do imóvel e valor pretendido e transfira para um corretor especialista.',
    },
  ],
  'Barbearias & Estética': [
    {
      category: 'service',
      title: 'Tabela de Serviços e Combos',
      content:
        'Oferecemos corte masculino, barba terapia com toalha quente, combo corte + barba, sobrancelha, limpeza de pele e procedimentos estéticos. Edite este item com os valores atualizados da sua tabela.',
    },
    {
      category: 'service',
      title: 'Como Agendar Horário',
      content:
        'Atendemos com hora marcada e encaixe conforme disponibilidade. Pergunte qual serviço o cliente deseja, profissional de preferência (se houver) e melhor dia/horário.',
    },
    {
      category: 'policy',
      title: 'Tolerância de Atraso e Cancelamento',
      content:
        'Nossa tolerância para atrasos é de 10 minutos para não prejudicar os próximos horários. Caso precise remarcar, avise com pelo menos 2 horas de antecedência.',
    },
    {
      category: 'faq',
      title: 'Formas de Pagamento e Ambiente',
      content:
        'Aceitamos Pix, cartões de débito/crédito e dinheiro. Ambiente climatizado com Wi-Fi e café/bebida de cortesia.',
    },
  ],
  'Comércio & Lojas': [
    {
      category: 'product',
      title: 'Consulta de Estoque, Tamanhos e Orçamentos',
      content:
        'Trabalhamos com pronta-entrega e encomendas. Peça ao cliente o nome ou foto do produto desejado (e tamanho/cor, se aplicável) para confirmar disponibilidade e preço.',
    },
    {
      category: 'service',
      title: 'Entrega, Motoboy e Frete',
      content:
        'Realizamos entregas rápidas por motoboy na região e enviamos para todo o Brasil via Correios/transportadora. Também temos opção de retirada gratuita na loja.',
    },
    {
      category: 'faq',
      title: 'Formas de Pagamento e Parcelamento',
      content:
        'Aceitamos Pix com desconto à vista, cartão de crédito parcelado sem juros (consulte parcela mínima) e cartão de débito.',
    },
    {
      category: 'policy',
      title: 'Política de Trocas e Garantia',
      content:
        'Trocas podem ser realizadas em até 7 dias corridos (compras online) ou conforme política da loja, com etiqueta fixada e nota/comprovante.',
    },
  ],
  'Escritórios & Serviços': [
    {
      category: 'service',
      title: 'Áreas de Atuação e Escopo dos Serviços',
      content:
        'Atendemos pessoas físicas e empresas com atendimento consultivo personalizado. Pergunte brevemente qual a necessidade principal do cliente para direcionar ao especialista responsável.',
    },
    {
      category: 'service',
      title: 'Agendamento de Reunião Online ou Presencial',
      content:
        'Realizamos reuniões presenciais no escritório ou por videoconferência (Google Meet/WhatsApp). Solicite nome, empresa (se houver), resumo da demanda e preferência de turno.',
    },
    {
      category: 'faq',
      title: 'Orçamentos, Propostas e Honorários',
      content:
        'Os valores dependem da complexidade da demanda. Após entender os dados básicos pelo atendimento inicial, nossa equipe envia proposta formal detalhada.',
    },
    {
      category: 'faq',
      title: 'Horário Comercial e Endereço',
      content:
        'Atendimento humano de segunda a sexta, das 08h30 às 18h00. Documentos podem ser enviados em PDF ou foto diretamente aqui no WhatsApp.',
    },
  ],
  'Pet Shop & Veterinária': [
    {
      category: 'service',
      title: 'Banho, Tosa e Estética Animal',
      content:
        'Realizamos banho, tosa higiênica, tosa na tesoura/máquina e hidratação. Os valores variam conforme porte e pelagem do pet — pergunte o nome do pet, raça/porte e dia desejado.',
    },
    {
      category: 'service',
      title: 'Consultas Veterinárias e Vacinas',
      content:
        'Contamos com atendimento clínico veterinário e protocolo completo de vacinação importada. Em caso de urgência/emergência com o pet, sinalize imediatamente nossa equipe humana.',
    },
    {
      category: 'service',
      title: 'Táxi Dog e Entrega de Rações/Medicamentos',
      content:
        'Temos serviço de leva e traz (Táxi Dog) mediante agendamento e entregamos rações, antipulgas e acessórios em domicílio.',
    },
    {
      category: 'faq',
      title: 'Requisitos para Banho e Tosa',
      content:
        'Para segurança de todos os pets, recomendamos vacinação em dia e controle de pulgas/carrapatos. Informe caso seu pet tenha alergia ou sensibilidade específica.',
    },
  ],
};

export const DEFAULT_TEMPLATES: KnowledgeTemplateItem[] = [
  {
    category: 'faq',
    title: 'Horário de Atendimento e Endereço',
    content:
      'Nosso horário comercial é de segunda a sexta das 08h às 18h e aos sábados das 08h às 12h. Edite este cartão com seu endereço completo.',
  },
  {
    category: 'faq',
    title: 'Formas de Pagamento Aceitas',
    content: 'Aceitamos Pix, Cartão de Crédito, Cartão de Débito e Dinheiro.',
  },
  {
    category: 'service',
    title: 'Agendamento e Solicitação de Orçamento',
    content:
      'Para agendar um horário ou receber orçamento personalizado, informe seu nome e o serviço/produto que procura que confirmamos na sequência!',
  },
];

export function getTemplatesForSegment(segment?: string | null): KnowledgeTemplateItem[] {
  if (!segment) return DEFAULT_TEMPLATES;
  return SEGMENT_TEMPLATES[segment] || DEFAULT_TEMPLATES;
}
