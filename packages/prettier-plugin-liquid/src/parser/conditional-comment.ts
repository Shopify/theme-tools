const commentRegex = /(<!--\[if[^\]]*]>)((.|\n)*)(<!\[endif\]-->)$/;

export const getConditionalComment = (comment: string) => {
  const matches = comment.match(commentRegex);
  if (matches) {
    return {
      startTag: matches[1],
      body: matches[2].trim(),
      endTag: matches[4],
    };
  }
};
