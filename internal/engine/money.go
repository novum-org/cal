package engine

import (
	"math"
	"strconv"
	"strings"
)

func ToCents(n float64) int64 {
	if math.IsNaN(n) || math.IsInf(n, 0) {
		return 0
	}
	return int64(math.Round(n * 100))
}

func ToUSD(c int64) float64 {
	return float64(c) / 100
}

func pad2(n int64) string {
	if n < 10 {
		return "0" + strconv.FormatInt(n, 10)
	}
	return strconv.FormatInt(n, 10)
}

// FormatUSD matches Intl.NumberFormat en-US currency, two fraction digits.
func FormatUSD(n float64) string {
	neg := n < 0
	if neg {
		n = -n
	}
	cents := ToCents(n)
	whole := cents / 100
	frac := cents % 100
	digits := strconv.FormatInt(whole, 10)
	var grouped strings.Builder
	if len(digits) <= 3 {
		grouped.WriteString(digits)
	} else {
		lead := len(digits) % 3
		if lead == 0 {
			lead = 3
		}
		grouped.WriteString(digits[:lead])
		for i := lead; i < len(digits); i += 3 {
			grouped.WriteByte(',')
			grouped.WriteString(digits[i : i+3])
		}
	}
	sign := ""
	if neg {
		sign = "-"
	}
	return sign + "$" + grouped.String() + "." + pad2(frac)
}
