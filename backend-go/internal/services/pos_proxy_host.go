package services

import (
	"net/url"
	"regexp"
	"strings"
)

const posProxyMerchantPlaceholder = "{merchant_id}"
const posProxyHostParsePlaceholder = "merchant-placeholder"

type POSProxyHostResolver struct {
	template string
	regex    *regexp.Regexp
}

func NewPOSProxyHostResolver(template string) (*POSProxyHostResolver, error) {
	trimmedTemplate := strings.TrimSpace(template)
	if trimmedTemplate == "" {
		return &POSProxyHostResolver{}, nil
	}

	parseableTemplate := strings.ReplaceAll(trimmedTemplate, posProxyMerchantPlaceholder, posProxyHostParsePlaceholder)
	parsedURL, err := url.Parse(parseableTemplate)
	if err != nil {
		return nil, err
	}

	hostPattern := strings.ReplaceAll(parsedURL.Host, posProxyHostParsePlaceholder, posProxyMerchantPlaceholder)
	escapedPattern := regexp.QuoteMeta(hostPattern)
	escapedPlaceholder := regexp.QuoteMeta(posProxyMerchantPlaceholder)
	regexPattern := "^" + strings.Replace(escapedPattern, escapedPlaceholder, "([a-z0-9-]+)", 1) + "$"

	compiledRegex, err := regexp.Compile(regexPattern)
	if err != nil {
		return nil, err
	}

	return &POSProxyHostResolver{
		template: trimmedTemplate,
		regex:    compiledRegex,
	}, nil
}

func (r *POSProxyHostResolver) BuildURL(merchantID string) (string, bool) {
	if r == nil || strings.TrimSpace(r.template) == "" {
		return "", false
	}

	trimmedMerchantID := strings.TrimSpace(merchantID)
	if trimmedMerchantID == "" {
		return "", false
	}

	proxyURL := strings.ReplaceAll(r.template, posProxyMerchantPlaceholder, strings.ToLower(trimmedMerchantID))
	if strings.HasSuffix(proxyURL, "/") {
		return proxyURL, true
	}
	return proxyURL + "/", true
}

func (r *POSProxyHostResolver) ResolveMerchantID(host string) (string, bool) {
	if r == nil || r.regex == nil {
		return "", false
	}

	trimmedHost := strings.TrimSpace(host)
	matches := r.regex.FindStringSubmatch(strings.ToLower(trimmedHost))
	if len(matches) != 2 {
		return "", false
	}

	return strings.ToUpper(matches[1]), true
}
