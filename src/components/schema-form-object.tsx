import React, { useState } from 'react'
import { ComponentForType } from './component-for-type'
import { ErrorObject } from '../error'
import { fieldCaption } from '../schema/schema'
import { ISchemaContainerProps } from './schema-form-interfaces';
import _ from 'lodash';

type NestedList = string | NestedListArray;
interface NestedListArray extends Array<NestedList> {}

const firstNestedString = (list: NestedList): [ string, number ] => {
    if (typeof list === 'string') {
        return [ list, 0 ];
    } else {
        const [ item, innerDepth ] = firstNestedString(list[0]);
        return [ item, innerDepth + 1];
    }
}

export function SchemaFormObject({
    schema,
    path,
    value,
    errors,
    onFocus,
    onBlur,
    onEditor,
    context
}: ISchemaContainerProps): React.ReactElement {
    const [ collapsed, setCollapsed ] = useState(false);
    const pathEl = path.length ? _.last(path) : '';
    const objectClass = path.length === 0 ? "" : "sf-object sf-" + pathEl;

    function renderSection(order: NestedList, properties: [string, unknown][], requireds?: string[], i?: number) {
        if (typeof order === 'string') {
            const [key, subSchema] = properties.find(([key, _]) => key === order) || ['', null];
            if (key) {
                return (
                    <ComponentForType
                        schema={subSchema as object}
                        path={[ ...path, key ]}
                        value={value && value[key]}
                        isRequired={requireds && requireds.indexOf(key) >= 0}
                        errors={ErrorObject.forKey(errors, key)}
                        onFocus={onFocus}
                        onBlur={onBlur}
                        onEditor={onEditor}
                        key={key}
                        context={context}/>
                )
            }
        } else { // recurse into a section list
            const [ firstKey, depth ] = firstNestedString(order);
            return (
                <section key={i || 0} className={`group-${depth}-${firstKey}`}>
                    {order.map((subOrder, i) => renderSection(subOrder, properties, requireds, i))}
                </section>
            )
        }
        return <></>;
    }
    
    let topOrder: NestedListArray = schema['propertyOrder'] || Object.keys(schema['properties'] || {});
    let properties = Object.entries(schema['properties'] || {});
    let requireds = schema['required'];
    if (schema['propertyOrder'] && _.flatten(schema['propertyOrder']).length < properties.length) {
        console.log('fewer items in order than properties at ' + path.join('.'));
    }
    const collapsible = (context.collapsible && path.length > 0) || false;
    const onCollapserClick = () => setCollapsed(collapsed => !collapsed);
    const collapserClasses = "sf-collapser " + (collapsed ? "sf-collapsed" : "sf-open");
    const caption = fieldCaption(schema, path);
    const showTitle = path.length > 0 && (collapsible || caption);

    return (
        <div className={objectClass}>
            {showTitle && <div className="sf-title">
                {collapsible && <span className={collapserClasses} onClick={onCollapserClick}></span>}
                {fieldCaption(schema, path, value) || '\u00A0'}
            </div>}
            {!collapsed && <div className="sf-object-fieldset fieldset">
                {topOrder.map((subOrder) => renderSection(subOrder, properties, requireds))}
            </div>}
        </div>
    )
}