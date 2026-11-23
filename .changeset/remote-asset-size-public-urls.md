---
'@shopify/theme-check-common': patch
'@shopify/theme-check-node': patch
'theme-check-rs': patch
---

`AssetSizeCSS` and `AssetSizeJavaScript` read the size of a remote file only at a public address. They send no request to a URL that is not http(s), that has a user name or password, or whose host is `localhost` or an IP address that is not public (loopback, private, link-local, carrier-grade NAT, unique local and other special-purpose ranges). They do not follow redirects: a redirect gives size 0. In theme-check-node and the Rust port, a host name that resolves to an address that is not public gets no request either, and the request goes to the address that was checked.
