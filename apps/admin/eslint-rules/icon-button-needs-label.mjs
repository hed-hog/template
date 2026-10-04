/**
 * Botão só-com-ícone precisa de tooltip.
 *
 * A regra do admin é tooltip visível: `aria-label` sozinho resolve leitor de tela,
 * mas não diz ao usuário para que o botão serve. Ver .claude/skills/admin-buttons.
 */

const ICON_SIZES = new Set(['icon', 'icon-sm', 'icon-lg']);

function getAttribute(node, name) {
  return node.attributes.find(
    (attribute) =>
      attribute.type === 'JSXAttribute' && attribute.name?.name === name
  );
}

function hasSpread(node) {
  return node.attributes.some(
    (attribute) => attribute.type === 'JSXSpreadAttribute'
  );
}

function isIconSize(node) {
  const size = getAttribute(node, 'size');
  if (!size || !size.value) {
    return false;
  }
  if (size.value.type === 'Literal') {
    return ICON_SIZES.has(size.value.value);
  }
  if (
    size.value.type === 'JSXExpressionContainer' &&
    size.value.expression.type === 'Literal'
  ) {
    return ICON_SIZES.has(size.value.expression.value);
  }
  // size dinâmico (variável, ternário): não dá para decidir estaticamente.
  return false;
}

function insideTooltipTrigger(node) {
  let current = node.parent;
  while (current) {
    if (
      current.type === 'JSXElement' &&
      current.openingElement?.name?.type === 'JSXIdentifier' &&
      current.openingElement.name.name === 'TooltipTrigger'
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Exige tooltip em <Button> só-com-ícone (size icon, icon-sm, icon-lg).',
    },
    schema: [],
    messages: {
      missingTooltip:
        'Botão só-com-ícone precisa de `tooltip` explicando a ação. Ver .claude/skills/admin-buttons.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name?.type !== 'JSXIdentifier' || node.name.name !== 'Button') {
          return;
        }
        if (!isIconSize(node) || hasSpread(node)) {
          return;
        }
        if (getAttribute(node, 'tooltip') || insideTooltipTrigger(node)) {
          return;
        }
        context.report({ node, messageId: 'missingTooltip' });
      },
    };
  },
};

export default rule;
