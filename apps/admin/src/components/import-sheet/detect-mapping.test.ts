import { describe, expect, it } from 'vitest';
import {
  IGNORE_VALUE,
  detectMapping,
  normalizeCustomKey,
  type ImportField,
} from './detect-mapping';

/** Recorte do catálogo real do CRM, com os aliases que importam aqui. */
const FIELDS: ImportField[] = [
  { value: IGNORE_VALUE, label: 'Ignorar' },
  {
    value: 'name',
    label: 'Nome',
    aliases: ['nome', 'nome completo', 'razao social', 'cliente', 'full name'],
  },
  { value: 'type', label: 'Tipo', aliases: ['tipo', 'tipo pessoa'] },
  { value: 'status', label: 'Status', aliases: ['situacao', 'ativo'] },
  { value: 'email', label: 'E-mail', aliases: ['e mail', 'mail'] },
  {
    value: 'phone',
    label: 'Telefone',
    aliases: ['telefone', 'fone', 'tel', 'telefone fixo'],
  },
  {
    value: 'mobile',
    label: 'Celular',
    aliases: ['celular', 'cel', 'movel', 'whatsapp', 'telefone celular'],
  },
  { value: 'cpf', label: 'CPF', aliases: ['documento', 'doc'] },
  { value: 'job_title', label: 'Cargo', aliases: ['cargo', 'funcao'] },
  {
    value: 'company_name',
    label: 'Empresa',
    aliases: ['empresa', 'empregador', 'organizacao', 'company'],
  },
  { value: 'source', label: 'Origem', aliases: ['origem', 'fonte', 'canal'] },
  {
    value: 'address_street',
    label: 'Endereço — Logradouro',
    aliases: [
      'endereco',
      'logradouro',
      'rua',
      'avenida',
      'endereco logradouro',
      'street',
      'address',
    ],
  },
  {
    value: 'address_number',
    label: 'Endereço — Número',
    aliases: ['numero', 'num', 'nro', 'endereco numero', 'number'],
  },
  {
    value: 'address_neighborhood',
    label: 'Endereço — Bairro',
    aliases: ['bairro', 'distrito', 'endereco bairro', 'neighborhood'],
  },
  {
    value: 'address_complement',
    label: 'Endereço — Complemento',
    aliases: ['complemento', 'compl', 'apto', 'endereco complemento'],
  },
  {
    value: 'address_city',
    label: 'Endereço — Cidade',
    aliases: ['cidade', 'municipio', 'localidade', 'endereco cidade'],
  },
  {
    value: 'address_state',
    label: 'Endereço — Estado',
    aliases: ['estado', 'uf', 'provincia', 'endereco estado', 'endereco uf'],
  },
  {
    value: 'address_zip',
    label: 'Endereço — CEP',
    aliases: ['cep', 'codigo postal', 'endereco cep', 'zip', 'postal code'],
  },
  {
    value: 'address_country',
    label: 'Endereço — País',
    aliases: ['pais', 'endereco pais', 'country'],
  },
  {
    value: 'notes',
    label: 'Observações',
    aliases: ['observacoes', 'obs', 'notas', 'comentarios'],
  },
];

describe('detectMapping', () => {
  it('reconhece o cabeçalho brasileiro típico de uma exportação', () => {
    const columns = [
      'Nome Completo',
      'Tipo',
      'Situação',
      'E-mail',
      'Telefone',
      'Celular',
      'CPF',
      'Cargo',
      'Empresa',
      'Origem',
      'Endereço — Logradouro',
      'Endereço — Número',
      'Bairro',
      'Complemento',
      'Cidade',
      'UF',
      'CEP',
      'País',
      'Observações',
    ];

    expect(detectMapping(columns, FIELDS)).toEqual({
      'Nome Completo': 'name',
      Tipo: 'type',
      Situação: 'status',
      'E-mail': 'email',
      Telefone: 'phone',
      Celular: 'mobile',
      CPF: 'cpf',
      Cargo: 'job_title',
      Empresa: 'company_name',
      Origem: 'source',
      'Endereço — Logradouro': 'address_street',
      'Endereço — Número': 'address_number',
      Bairro: 'address_neighborhood',
      Complemento: 'address_complement',
      Cidade: 'address_city',
      UF: 'address_state',
      CEP: 'address_zip',
      País: 'address_country',
      Observações: 'notes',
    });
  });

  it('não confunde headers compostos que compartilham um prefixo', () => {
    // O caso que quebraria um matcher por `includes`: os dois começam com
    // "Endereço" e o alias "endereco" pertence a address_street.
    const mapping = detectMapping(
      ['Endereço — Número', 'Endereço — Logradouro'],
      FIELDS
    );

    expect(mapping['Endereço — Número']).toBe('address_number');
    expect(mapping['Endereço — Logradouro']).toBe('address_street');
  });

  it('normaliza acento, caixa e pontuação do header', () => {
    const mapping = detectMapping(
      ['  SITUAÇÃO  ', 'e-mail', 'Job_Title', 'jobTitle'],
      FIELDS
    );

    expect(mapping['  SITUAÇÃO  ']).toBe('status');
    expect(mapping['e-mail']).toBe('email');
    // Só a primeira coluna leva o campo; a segunda fica para o usuário.
    expect(mapping['Job_Title']).toBe('job_title');
    expect(mapping['jobTitle']).toBe(IGNORE_VALUE);
  });

  it('não atribui o mesmo campo a duas colunas', () => {
    const mapping = detectMapping(['Telefone', 'Fone', 'Tel'], FIELDS);

    const assigned = Object.values(mapping).filter((v) => v !== IGNORE_VALUE);
    expect(assigned).toEqual(['phone']);
    expect(mapping['Telefone']).toBe('phone');
  });

  it('deixa em branco o que não reconhece, em vez de chutar', () => {
    const mapping = detectMapping(
      ['Tamanho Camiseta', 'Coluna 7', 'xyz'],
      FIELDS
    );

    expect(mapping).toEqual({
      'Tamanho Camiseta': IGNORE_VALUE,
      'Coluna 7': IGNORE_VALUE,
      xyz: IGNORE_VALUE,
    });
  });

  it('cobre headers compostos pelo alias composto, não por substring', () => {
    const mapping = detectMapping(
      ['Endereço CEP', 'Endereço Número', 'Endereço Bairro'],
      FIELDS
    );

    expect(mapping).toEqual({
      'Endereço CEP': 'address_zip',
      'Endereço Número': 'address_number',
      'Endereço Bairro': 'address_neighborhood',
    });
  });

  it('não pesca um campo por substring de um header mais longo', () => {
    // Regressão: com um tier de substring, "Endereço de cobrança CEP" casava
    // o alias genérico `endereco` (de address_street) e nunca chegava a `cep`,
    // mapeando um CEP para logradouro sem o usuário perceber. E "Numero do
    // doc antigo" virava o número do endereço. Nenhum dos dois é reconhecível
    // com segurança — ficam para o usuário.
    const mapping = detectMapping(
      ['Endereço de cobrança CEP', 'Numero do doc antigo'],
      FIELDS
    );

    expect(mapping).toEqual({
      'Endereço de cobrança CEP': IGNORE_VALUE,
      'Numero do doc antigo': IGNORE_VALUE,
    });
  });

  it('devolve todas as colunas, inclusive as vazias e duplicadas', () => {
    const mapping = detectMapping(['Nome', '', 'Nome'], FIELDS);

    expect(Object.keys(mapping).sort()).toEqual(['', 'Nome']);
    expect(mapping['']).toBe(IGNORE_VALUE);
  });

  it('respeita allowMultiple, deixando o campo disponível para outra coluna', () => {
    const fields: ImportField[] = [
      { value: IGNORE_VALUE, label: 'Ignorar' },
      { value: 'tag', label: 'Tag', aliases: ['etiqueta'], allowMultiple: true },
    ];

    expect(detectMapping(['Tag', 'Etiqueta'], fields)).toEqual({
      Tag: 'tag',
      Etiqueta: 'tag',
    });
  });
});

describe('normalizeCustomKey', () => {
  it('transforma um rótulo digitado em chave de metadata', () => {
    expect(normalizeCustomKey('Tamanho da camiseta')).toBe(
      'tamanho_da_camiseta'
    );
    expect(normalizeCustomKey('  Nº do Contrato  ')).toBe('n_do_contrato');
    expect(normalizeCustomKey('---')).toBe('');
  });

  it('limita o tamanho da chave', () => {
    expect(normalizeCustomKey('a'.repeat(100))).toHaveLength(64);
  });
});
