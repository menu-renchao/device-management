package services

import "strings"

const menuPackageFormatVersion = "1"

type MenuDomainSpec struct {
	TableOrder              []string
	ClearOrder              []string
	FieldDisplayNameTypes   []string
	allowedTables           map[string]struct{}
	allowedFieldDisplayType map[string]struct{}
}

func NewMenuDomainSpec() MenuDomainSpec {
	tableOrder := []string{
		"system_language",
		"membership_level",
		"company_tax",
		"inventory_vendor",
		"inventory_location",
		"inventory_item_group",
		"inventory_item",
		"inventory_count_record",
		"inventory_item_change_record",
		"item_unit",
		"item_property",
		"item_size",
		"course",
		"restaurant_hours",
		"printer",
		"menu",
		"menu_group",
		"menu_category",
		"menu_item",
		"combo_section",
		"menu_item_info",
		"menu_item_recipe",
		"menugroup_hours_assoc",
		"category_tax_assoc",
		"combo_section_item_assoc",
		"combo_item_section_assoc",
		"saleitem_rule_assoc",
		"saleitem_property_assoc",
		"pricing_rule",
		"sale_item_price",
		"item_printer_assoc",
		"field_display_name",
	}

	clearOrder := []string{
		"inventory_count_record",
		"inventory_item_change_record",
		"inventory_item",
		"inventory_item_group",
		"inventory_location",
		"inventory_vendor",
		"item_printer_assoc",
		"menu_item_recipe",
		"menu_item_info",
		"combo_section_item_assoc",
		"combo_item_section_assoc",
		"sale_item_price",
		"saleitem_rule_assoc",
		"saleitem_property_assoc",
		"pricing_rule",
		"menugroup_hours_assoc",
		"category_tax_assoc",
		"field_display_name",
		"menu_item",
		"menu_category",
		"menu_group",
		"menu",
		"combo_section",
		"item_size",
		"item_unit",
		"item_property",
		"course",
		"restaurant_hours",
		"company_tax",
		"printer",
		"membership_level",
	}

	fieldDisplayNameTypes := []string{
		"MENU_GROUP",
		"CATEGORY",
		"SALE_ITEM",
		"COMBO_SECTION",
		"MODIFIER_ACTION",
		"GLOBAL_OPTION_CATEGORY",
		"GLOBAL_OPTION",
		"ITEM_SIZE",
		"MENU",
		"ITEM_OPTION",
	}

	spec := MenuDomainSpec{
		TableOrder:            tableOrder,
		ClearOrder:            clearOrder,
		FieldDisplayNameTypes: fieldDisplayNameTypes,
		allowedTables:         make(map[string]struct{}, len(tableOrder)),
		allowedFieldDisplayType: make(map[string]struct{},
			len(fieldDisplayNameTypes)),
	}

	for _, table := range tableOrder {
		spec.allowedTables[table] = struct{}{}
	}
	for _, fieldType := range fieldDisplayNameTypes {
		spec.allowedFieldDisplayType[fieldType] = struct{}{}
	}

	return spec
}

func (s MenuDomainSpec) AllowsTable(table string) bool {
	_, ok := s.allowedTables[strings.TrimSpace(table)]
	return ok
}

func (s MenuDomainSpec) AllowsFieldDisplayNameType(fieldType string) bool {
	_, ok := s.allowedFieldDisplayType[strings.TrimSpace(fieldType)]
	return ok
}
