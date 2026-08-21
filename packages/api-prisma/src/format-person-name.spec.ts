import {
  applyPersonNameToArgs,
  formatPersonName,
  isLikelyCompanyDocument,
} from './format-person-name';

/**
 * Estes exemplos são a referência compartilhada com a migration de backfill
 * (apps/api/prisma/migrations/*_person_user_name_backfill), que reimplementa a mesma
 * regra em SQL. Ao mexer aqui, conferir os dois lados.
 */
describe('formatPersonName', () => {
  describe('recaixa o que está inteiramente em maiúsculo ou minúsculo', () => {
    const cases: Array<[string, string]> = [
      ['APARECIDA DA SILVA', 'Aparecida da Silva'],
      [
        'drielle jhenyffer da silva colares santana',
        'Drielle Jhenyffer da Silva Colares Santana',
      ],
      ['MARCSOS VINICIUS MOREIRA BARACHO', 'Marcsos Vinicius Moreira Baracho'],
      ['ISABELLE FERREIRA ALVES VIEIRA', 'Isabelle Ferreira Alves Vieira'],
      ['DANIEL LEANDRO DE OLIVEIRA LEÃO', 'Daniel Leandro de Oliveira Leão'],
      ['natalia firmino silva de souza', 'Natalia Firmino Silva de Souza'],
      ['JOSÉ', 'José'],
    ];

    it.each(cases)('%s -> %s', (input, expected) => {
      expect(formatPersonName(input)).toBe(expected);
    });
  });

  it('mantém o conectivo em maiúsculo quando ele abre o nome', () => {
    expect(formatPersonName('DA SILVA JUNIOR')).toBe('Da Silva Junior');
  });

  it('deixa os conectivos do meio em minúsculo', () => {
    expect(formatPersonName('MARIA DOS SANTOS E COSTA')).toBe(
      'Maria dos Santos e Costa',
    );
  });

  it('preserva numeral dinástico', () => {
    expect(formatPersonName('JOAO PEDRO III')).toBe('Joao Pedro III');
  });

  it('capitaliza depois de apóstrofo, hífen e ponto', () => {
    expect(formatPersonName("d'avila sant'ana")).toBe("D'Avila Sant'Ana");
    expect(formatPersonName('ana-maria de souza')).toBe('Ana-Maria de Souza');
    expect(formatPersonName('j.p. da costa')).toBe('J.P. da Costa');
  });

  describe('não toca em nome que já tem caixa mista', () => {
    const untouched = [
      'João da Silva',
      'Yasmin Côrtes Franco Souza',
      'McDonald',
      "D'Ávila",
      'Usuário removido',
      'Usuário 42',
      'Anônimo (para avaliações)',
    ];

    it.each(untouched)('%s', (input) => {
      expect(formatPersonName(input)).toBe(input);
    });
  });

  it('não recaixa e-mail gravado no campo nome', () => {
    expect(formatPersonName('joao@hcode.com.br')).toBe('joao@hcode.com.br');
  });

  it('normaliza espaços mesmo sem recaixar', () => {
    expect(formatPersonName('  Ana   Maria  ')).toBe('Ana Maria');
    expect(formatPersonName('  MARIA   JOSE  ')).toBe('Maria Jose');
  });

  it('devolve string vazia para valor ausente', () => {
    expect(formatPersonName(null)).toBe('');
    expect(formatPersonName(undefined)).toBe('');
    expect(formatPersonName('   ')).toBe('');
  });

  it('não mexe em string sem letra', () => {
    expect(formatPersonName('12345')).toBe('12345');
  });
});

describe('applyPersonNameToArgs', () => {
  const individual = async () => true;
  const notIndividual = async () => false;

  it('formata o nome de um create de pessoa física', async () => {
    const args = { data: { name: 'APARECIDA DA SILVA', type: 'individual' } };

    expect(await applyPersonNameToArgs('create', args, notIndividual)).toEqual({
      data: { name: 'Aparecida da Silva', type: 'individual' },
    });
  });

  it('não toca em pessoa jurídica', async () => {
    const args = { data: { name: 'HCODE TECNOLOGIA LTDA', type: 'company' } };

    expect(await applyPersonNameToArgs('create', args, individual)).toBe(args);
  });

  it('devolve a mesma referência quando o nome já está formatado', async () => {
    const args = { data: { name: 'Aparecida da Silva', type: 'individual' } };

    expect(await applyPersonNameToArgs('create', args, individual)).toBe(args);
  });

  it('não consulta o tipo quando não há nada a mudar', async () => {
    const resolve = jest.fn(async () => true);
    const args = { data: { name: 'Aparecida da Silva' }, where: { id: 1 } };

    await applyPersonNameToArgs('update', args, resolve);

    expect(resolve).not.toHaveBeenCalled();
  });

  it('consulta o tipo uma única vez quando a escrita não o declara', async () => {
    const resolve = jest.fn(async () => true);
    const args = {
      data: { name: 'MARIA JOSE' },
      where: { id: 1 },
    };

    expect(await applyPersonNameToArgs('update', args, resolve)).toEqual({
      data: { name: 'Maria Jose' },
      where: { id: 1 },
    });
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('desiste quando o tipo não pôde ser confirmado como pessoa física', async () => {
    const args = { data: { name: 'MARIA JOSE' }, where: { id: 1 } };

    expect(await applyPersonNameToArgs('update', args, notIndividual)).toBe(args);
  });

  it('entende o envelope { set } do update', async () => {
    const args = { data: { name: { set: 'MARIA JOSE' } }, where: { id: 1 } };

    expect(await applyPersonNameToArgs('update', args, individual)).toEqual({
      data: { name: { set: 'Maria Jose' } },
      where: { id: 1 },
    });
  });

  it('cobre os dois ramos do upsert', async () => {
    const args = {
      where: { id: 1 },
      create: { name: 'MARIA JOSE', type: 'individual' },
      update: { name: 'maria jose' },
    };

    expect(await applyPersonNameToArgs('upsert', args, individual)).toEqual({
      where: { id: 1 },
      create: { name: 'Maria Jose', type: 'individual' },
      update: { name: 'Maria Jose' },
    });
  });

  it('formata linha a linha no createMany, respeitando o tipo de cada uma', async () => {
    const args = {
      data: [
        { name: 'MARIA JOSE', type: 'individual' },
        { name: 'HCODE TECNOLOGIA LTDA', type: 'company' },
        { name: 'joao pedro', type: 'individual' },
      ],
    };

    expect(await applyPersonNameToArgs('createMany', args, notIndividual)).toEqual({
      data: [
        { name: 'Maria Jose', type: 'individual' },
        { name: 'HCODE TECNOLOGIA LTDA', type: 'company' },
        { name: 'Joao Pedro', type: 'individual' },
      ],
    });
  });

  it('não muta os args recebidos', async () => {
    const args = { data: { name: 'MARIA JOSE', type: 'individual' } };

    await applyPersonNameToArgs('create', args, individual);

    expect(args.data.name).toBe('MARIA JOSE');
  });

  it('ignora operações de leitura', async () => {
    const args = { where: { name: 'MARIA JOSE' } };

    expect(await applyPersonNameToArgs('findMany', args, individual)).toBe(args);
  });

  it('ignora escrita que não mexe no nome', async () => {
    const args = { data: { status: 'inactive' }, where: { id: 1 } };

    expect(await applyPersonNameToArgs('update', args, individual)).toBe(args);
  });

  describe('campo customizado (field)', () => {
    it('normaliza a coluna indicada, não "name"', async () => {
      const args = { data: { requester_name: 'MARIA JOSE' } };

      expect(
        await applyPersonNameToArgs('create', args, individual, 'requester_name'),
      ).toEqual({ data: { requester_name: 'Maria Jose' } });
    });

    it('ignora a coluna "name" quando ela existe mas o campo pedido é outro', async () => {
      // Caso real: ceia_partner tem `name` (organização) e `contact_name` (pessoa) na
      // mesma tabela — normalizar sempre "name" pegaria a coluna errada.
      const args = { data: { name: 'ORGANIZACAO LTDA', contact_name: 'MARIA JOSE' } };

      expect(
        await applyPersonNameToArgs('create', args, individual, 'contact_name'),
      ).toEqual({ data: { name: 'ORGANIZACAO LTDA', contact_name: 'Maria Jose' } });
    });

    it('entende o envelope { set } também no campo customizado', async () => {
      const args = { data: { author_name: { set: 'MARIA JOSE' } } };

      expect(
        await applyPersonNameToArgs('update', args, individual, 'author_name'),
      ).toEqual({ data: { author_name: { set: 'Maria Jose' } } });
    });
  });
});

describe('isLikelyCompanyDocument', () => {
  it('reconhece CNPJ com máscara', () => {
    expect(isLikelyCompanyDocument('12.345.678/0001-90')).toBe(true);
  });

  it('reconhece CNPJ sem máscara', () => {
    expect(isLikelyCompanyDocument('12345678000190')).toBe(true);
  });

  it('não trata CPF como empresa', () => {
    expect(isLikelyCompanyDocument('123.456.789-01')).toBe(false);
    expect(isLikelyCompanyDocument('12345678901')).toBe(false);
  });

  it('trata documento ausente ou vazio como pessoa física', () => {
    expect(isLikelyCompanyDocument(null)).toBe(false);
    expect(isLikelyCompanyDocument(undefined)).toBe(false);
    expect(isLikelyCompanyDocument('')).toBe(false);
  });

  it('trata contagem de dígitos fora do padrão como pessoa física', () => {
    expect(isLikelyCompanyDocument('123')).toBe(false);
  });
});
