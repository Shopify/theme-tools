## Intro

Wanted to know how hard it is [to do like the Handlebars folks](https://prettier.io/blog/2021/05/09/2.3.0.html#:~:text=The%20feature%20is,under%20the%20hood.) and make a prettier plugin for Liquid.

Our problem: Liquid is a _templating_ language. As such, its Abstract Syntax Tree (AST) has no notion of what its text nodes contain.

And since [prettier](https://prettier.io/) is really a `function(ast) -> string`, you can't make pretty Liquid + HTML if the AST you have has no notion of HTML.

It's possible though:

https://user-images.githubusercontent.com/4990691/145229362-568ab7d4-4345-42b7-8794-59f7683a88a3.mp4

## How we can handle it

First, we need to make a Liquid/HTML parser that supports a stricter form of Liquid—One that can form a tree.

This works:

```liquid
{% for product in all_products %}
  <img
    src="{{ product.featured_image | image_url }}"
    loading="lazy"
  >
{% endfor %}
```

Since it can be represented as this tree:

![docs/liquid-html-tree.png](docs/liquid-html-tree.png)

But this doesn't because the div is closed before the if tag was closed:

```liquid
{% if A %}<div>{% endif %}</div>
```

## How it works

1. We parse the liquid source code into an Liquid/HTML AST.
   1. Our [harc/ohm](https://github.com/harc/ohm) grammar tokenizes the source code.[(Link to LiquidHTML grammar.)](grammar/liquid-html.ohm)
   2. From Ohm's tokens, we build a Concrete Syntax Tree (CST). [(Link to Grammar->CST code.)](src/parsers/cst.ts)
   3. From the nodes in the CST, we build an AST. [(Link to CST->AST code.)](src/parsers/ast.ts)
2. From the AST, we build a [`Doc`](https://github.com/prettier/prettier/blob/main/commands.md#prettiers-intermediate-representation-doc) that prettier then prints for us.[(Link to LiquidHTML printer)](src/printers/printer-liquid-html.ts)

Here's a flowchart that roughly illustrates the process.

```mermaid
%%{init: { 'theme': 'dark', 'themeVariables': { 'fontFamily': 'monospace'} } }%%
flowchart TB
    subgraph INPUT
      s1["#lt;ul#gt;{% for el in col %}<br>#lt;li class=#quot;{% cycle 'odd', 'even' %}#quot;#gt;<br>  {{ el }}<br>#lt;/li#gt;<br>{%endfor%}<br>#lt;/ul#gt;"]
    end
    subgraph TOKENS ["OHM TOKENS"]
      direction TB
      t1["#lt;ul#gt;"] -->
      t2["{% for el in col %}"] --> t3
      subgraph t3 ["#lt;li class=#quot;{% cycle 'odd', 'even' %}#quot;#gt;"]
        t3.1["#lt;li"] ---
        t3.2["class="] ---
        t3.3["{% cycle 'odd', 'even' %}"] ---
        t3.4["#gt;"]
      end
      t3 -->
      t4["{{ el }}"] -->
      t5["#lt;/li#gt;"] -->
      t6["{%endfor%}"]
    end
    subgraph CST
      direction TB
      c1["HtmlTagOpen#ul"] --->
      c2["LiquidTagOpen#for el in col"] --->
      c3["HtmlTagOpen#li"]
      c3 -->
      c4["LiquidDrop#el"] -->
      c5["HtmlTagClose#li"] -->
      c6["LiquidTagClose#for"]
      c3 .- attributes .-
      c3a["HtmlAttribute"]
      c3a .- name .- c3an["class"]
      c3a .- value .- c3av
      c3av["LiquidTag#cycle 'odd', 'even'"]

    end
    subgraph AST
      direction TB
      a1["HtmlElement#ul"] -- children -->
      a2["LiquidTag#for el in col"] -- children -->
      a3["HtmlElement#li"]
      a3 -- children -->
      a4["LiquidDrop#el"]
      a3 -- attributes -->
      a3a["HtmlAttribute"]
      a3a -- name --> a3an["class"]
      a3a -- value --> a3av
      a3av["LiquidTag#cycle 'odd', 'even'"]
    end
    subgraph OUTPUT
      o1["#lt;ul#gt;<br>  {% for el in col %}<br>    #lt;li class=#quot;{% cycle 'odd', 'even' %}#quot;#gt;<br>      {{ el }}<br>    #lt;/li#gt;<br>  {% endfor %}<br>#lt;/ul#gt;"]
    end
    INPUT -- "ohmGrammar.match(input)" --> TOKENS
    TOKENS -- "toCST(tokens)" --> CST
    CST -- "toAST(cst)" --> AST
    AST -- "prettier.print(ast, options)" --> OUTPUT
    style TOKENS text-align: left;
    style s1 text-align:left
    style o1 text-align:left
```


