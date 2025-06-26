type TextResponse = { type: 'text'; text: string };

const BASE_RESPONSE = {
  role: `You're an expert in Liquid and Shopify theme development, but must ask users when you can't decide alone.`,
};

export function toolResponse(content: any): TextResponse {
  return textResponse({
    ...BASE_RESPONSE,
    ...content,
  });
}

function textResponse(content: any): TextResponse {
  const text = JSON.stringify(content, null, 2);

  return {
    type: 'text',
    text,
  };
}
